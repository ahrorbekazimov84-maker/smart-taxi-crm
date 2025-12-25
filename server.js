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

const oqish = () => {
    if (!fs.existsSync(DATA_FILE)) return { buyurtmalar: [], users: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
};

const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// SMS Kod simulyatsiyasi (Render Logs'da ko'rinadi)
app.post('/auth/send-code', (req, res) => {
    const code = Math.floor(1000 + Math.random() * 9000); // 4 xonali kod
    console.log(`[SMS SIMITATOR] Telefon: ${req.body.tel}, TASDIQLASH KODI: ${code}`);
    res.json({ status: "sent", debug_code: code }); // Debug uchun kodni qaytaramiz
});

app.post('/admin/login', (req, res) => {
    if (req.body.login === ADMIN_CONF.login && req.body.pass === ADMIN_CONF.pass) {
        res.json({ status: "ok" });
    } else {
        res.status(401).json({ status: "error" });
    }
});

// Buyurtmalar API (Avvalgi mantiq saqlangan)
app.get('/admin/buyurtmalar', (req, res) => res.json(oqish().buyurtmalar));

app.post('/buyurtma/berish', (req, res) => {
    const data = oqish();
    const yangi = { _id: Date.now().toString(), mijoz: req.body.ism, tel: req.body.tel, yonalish: req.body.yonalish, mijozLoc: req.body.mijozLoc, holati: 'Kutilmoqda', haydovchi: null, vaqt: new Date().toLocaleTimeString() };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    res.json(yangi);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Professional Server started on ${PORT}`));

