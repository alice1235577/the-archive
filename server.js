const express = require('express');
const multer = require('multer');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const app = express();

// 1. CẤU HÌNH HỆ THỐNG (Tăng giới hạn để nhận file nặng)
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Phục vụ các file tĩnh (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '.')));

// 2. CẤU HÌNH CLOUDINARY
cloudinary.config({ 
  cloud_name: 'dbfueegov', 
  api_key: '897271569798434', 
  api_secret: 'cZfEHMG6bSk0_UbcJIhZXd-9Zpk' 
});

// 3. CẤU HÌNH MONGODB
const uri = "mongodb+srv://maihoa29072005_db_user:1pzXdX8aUd6xaoGv@cluster0.12eyuyw.mongodb.net/TheArchive?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);
let dbCollection;

async function connectDB() {
    try {
        await client.connect();
        dbCollection = client.db("TheArchive").collection("files");
        console.log("🚀 Đã kết nối MongoDB Atlas vĩnh viễn!");
    } catch (e) {
        console.error("❌ Lỗi kết nối DB:", e);
    }
}
connectDB();

// Cấu hình lưu tạm file khi upload
const upload = multer({ dest: 'uploads/' });

// --- CÁC API HỆ THỐNG ---

// Trả về giao diện chính
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Lấy danh sách file
app.get('/api/files', async (req, res) => {
    try {
        const files = await dbCollection.find({}).toArray();
        res.json(files);
    } catch (e) {
        res.status(500).send(e);
    }
});

// API Upload (Đã tối ưu cho video nặng)
app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const { folder, type, owner, time } = req.body;
        const newEntries = [];

        for (let file of req.files) {
            // Tối ưu hóa việc đẩy file lên Cloudinary
            const result = await cloudinary.uploader.upload(file.path, {
                resource_type: "auto",
                folder: "the_archive",
                chunk_size: 6000000 // Chia nhỏ file để tránh lỗi timeout
            });

            const entry = {
                id: Date.now() + Math.random(),
                name: file.originalname,
                src: result.secure_url,
                type,
                folder,
                owner,
                time
            };

            await dbCollection.insertOne(entry);
            newEntries.push(entry);

            // Xóa file tạm sau khi đã lên Cloudinary
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
        res.json({ success: true, data: newEntries });
    } catch (error) {
        console.error("Lỗi upload chi tiết:", error);
        res.status(500).json({ error: "Lỗi upload. Có thể file quá nặng hoặc hết thời gian chờ." });
    }
});

// API Xóa file
app.delete('/api/files/:id', async (req, res) => {
    try {
        const idToDelete = req.params.id;
        await dbCollection.deleteOne({ 
            $or: [
                { id: parseFloat(idToDelete) },
                { id: idToDelete }
            ]
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).send(e);
    }
});

// 4. KHỞI CHẠY SERVER
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Tăng thời gian chờ (Timeout) lên 5 phút cho các file nặng
server.keepAliveTimeout = 300000;
server.headersTimeout = 301000;