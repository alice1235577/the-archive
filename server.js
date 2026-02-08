const express = require('express');
const multer = require('multer');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use(express.static(path.join(__dirname, '.')));

// 1. CẤU HÌNH CLOUDINARY
cloudinary.config({ 
    cloud_name: 'dbfueegov', 
    api_key: '897271569798434', 
    api_secret: 'cZfEHMG6bSk0_UbcJIhZXd-9Zpk' 
});

// 2. CẤU HÌNH MONGODB
const uri = "mongodb+srv://maihoa29072005_db_user:1pzXdX8aUd6xaoGv@cluster0.12eyuyw.mongodb.net/TheArchive?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);
let dbCollection;

async function connectDB() {
    try {
        await client.connect();
        dbCollection = client.db("TheArchive").collection("files");
        console.log("🚀 MongoDB Connected!");
    } catch (e) {
        console.error("❌ DB Error:", e);
    }
}
connectDB();

const upload = multer({ dest: 'uploads/' });

// --- API ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Lấy danh sách
app.get('/api/files', async (req, res) => {
    try {
        const files = await dbCollection.find({}).toArray();
        res.json(files);
    } catch (e) {
        res.status(500).send(e);
    }
});

/**
 * API MỚI: LƯU LINK TRỰC TIẾP
 * Dùng khi bạn tải lên từ trình duyệt thẳng tới Cloudinary
 */
app.post('/api/save-link', async (req, res) => {
    try {
        const entry = {
            ...req.body,
            id: Date.now() + Math.random()
        };
        await dbCollection.insertOne(entry);
        res.json({ success: true, data: entry });
    } catch (e) {
        res.status(500).json({ error: "Không thể lưu link" });
    }
});

// API Upload cũ (vẫn giữ để dự phòng)
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
                type, folder, owner, time
            };
            await dbCollection.insertOne(entry);
            newEntries.push(entry);
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
        res.json({ success: true, data: newEntries });
    } catch (error) {
        res.status(500).json({ error: "Server Render quá tải, hãy thử tải lên trực tiếp." });
    }
});

app.delete('/api/files/:id', async (req, res) => {
    try {
        const idToDelete = req.params.id;
        await dbCollection.deleteOne({ 
            $or: [{ id: parseFloat(idToDelete) }, { id: idToDelete }]
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).send(e);
    }
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Port ${PORT}`));
server.keepAliveTimeout = 300000;