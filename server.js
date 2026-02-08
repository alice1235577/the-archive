const express = require('express');
const multer = require('multer');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb'); // Thêm dòng này
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// 1. CẤU HÌNH CLOUDINARY
cloudinary.config({ 
  cloud_name: 'dbfueegov', 
  api_key: '897271569798434', 
  api_secret: 'cZfEHMG6bSk0_UbcJIhZXd-9Zpk' 
});

// 2. CẤU HÌNH MONGODB (Dùng URI bạn vừa gửi)
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

const upload = multer({ dest: 'uploads/' });

// 3. API LẤY DANH SÁCH FILE (Lấy từ MongoDB)
app.get('/api/files', async (req, res) => {
    try {
        const files = await dbCollection.find({}).toArray();
        res.json(files);
    } catch (e) {
        res.status(500).send(e);
    }
});

// 4. API UPLOAD (Lên Cloudinary & Lưu vào MongoDB)
app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const { folder, type, owner, time } = req.body;
        const newEntries = [];

        for (let file of req.files) {
            const result = await cloudinary.uploader.upload(file.path, {
                resource_type: "auto",
                folder: "the_archive"
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
            
            await dbCollection.insertOne(entry); // Lưu vào MongoDB
            newEntries.push(entry);
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
        res.json({ success: true, data: newEntries });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi upload" });
    }
});

// 5. API XÓA
app.delete('/api/files/:id', async (req, res) => {
    try {
        await dbCollection.deleteOne({ id: parseFloat(req.params.id) });
        res.json({ success: true });
    } catch (e) {
        res.status(500).send(e);
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));