const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const DATA_FILE = './baza.json';
const ADMIN_CONF = { login: "admin", pass: "taxi777" };

// Ma'lumotlarni o'qish funksiyasi
const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return { buyurtmalar: [] };
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return content ? JSON.parse(content) : { buyurtmalar: [] };
    } catch (e) { 
        console.error("Fayl o'qishda xato:", e);
        return { buyurtmalar: [] }; 
    }
};

// Ma'lumotlarni saqlash funksiyasi
const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// --- API YO'NALISHLARI ---

// SMS kod yuborish (Simulyatsiya)
app.post('/auth/send-code', (req, res) => {
    const code = Math.floor(1000 + Math.random() * 9000);
    console.log(`[SMS] Tel: ${req.body.tel}, Kod: ${code}`);
    res.json({ status: "sent", debug_code: code });
});

// Admin Login
app.post('/admin/login', (req, res) => {
    const { login, pass } = req.body;
    if (login === ADMIN_CONF.login && pass === ADMIN_CONF.pass) {
        res.json({ status: "ok" });
    } else {
        res.status(401).json({ status: "error" });
    }
});

// Buyurtmalarni olish
app.get('/admin/buyurtmalar', (req, res) => {
    res.json(oqish().buyurtmalar);
});

// Yangi buyurtma berish
app.post('/buyurtma/berish', (req, res) => {
    const data = oqish();
    const yangi = {
        _id: Date.now().toString(),
        mijoz: req.body.ism,
        tel: req.body.tel,
        yonalish: req.body.yonalish,
        mijozLoc: req.body.mijozLoc,
        holati: 'Kutilmoqda',
        haydovchi: null,
        vaqt: new Date().toLocaleTimeString('uz-UZ')
    };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi'); // Barcha foydalanuvchilarga xabar berish
    res.json(yangi);
});

// Haydovchi buyurtmani qabul qilishi
app.post('/buyurtma/qabul', (req, res) => {
    const { orderId, haydovchiIsm, haydovchiLoc } = req.body;
    let data = oqish();
    const order = data.buyurtmalar.find(b => b._id === orderId);
    if (order) {
        order.holati = "Yo'lda";
        order.haydovchi = haydovchiIsm;
        order.haydovchiLoc = haydovchiLoc;
        saqlash(data);
        io.emit('yangilash_chiqdi');
        res.json({ status: "ok" });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT}-portda ishladi`));
