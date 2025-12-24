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
const ADMIN_PASSWORD = "taxi777"; // Admin paroli

const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return { buyurtmalar: [] };
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return data ? JSON.parse(data) : { buyurtmalar: [] };
    } catch (e) { return { buyurtmalar: [] }; }
};

const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// Admin login tekshiruvi
app.post('/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) res.json({ status: "ok" });
    else res.status(401).json({ status: "xato" });
});

app.get('/admin/buyurtmalar', (req, res) => res.json(oqish().buyurtmalar));

app.post('/buyurtma/berish', (req, res) => {
    const data = oqish();
    const yangi = {
        _id: Date.now().toString(),
        mijoz: req.body.ism,
        tel: req.body.tel, // Telefon raqami qo'shildi
        yonalish: req.body.yonalish,
        mijozLoc: req.body.mijozLoc,
        holati: 'Kutilmoqda',
        haydovchi: null,
        haydovchiLoc: null,
        vaqt: new Date().toLocaleTimeString('uz-UZ')
    };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    res.json(yangi);
});

app.post('/buyurtma/qabul', (req, res) => {
    const { orderId, haydovchiIsm, haydovchiLoc } = req.body;
    let data = oqish();
    const order = data.buyurtmalar.find(b => b._id === orderId);
    if (order) {
        order.holati = "Yo'lda";
        order.haydovchi = haydovchiIsm;
        order.haydovchiLoc = haydovchiLoc;
        saqlash(data);
        // SMS logikasi (Simulyatsiya)
        console.log(`SMS: ${order.tel} raqamiga yuborildi: Haydovchi ${haydovchiIsm} yo'lga chiqdi!`);
        io.emit('yangilash_chiqdi');
        io.emit('haydovchi_harakati', { orderId, loc: haydovchiLoc });
        res.json({ status: "ok", mijozLoc: order.mijozLoc });
    }
});

app.post('/buyurtma/yakunlash', (req, res) => {
    const { orderId } = req.body;
    let data = oqish();
    const order = data.buyurtmalar.find(b => b._id === orderId);
    if (order) {
        order.holati = 'Yetkazildi';
        saqlash(data);
        io.emit('yangilash_chiqdi');
        res.json({ status: "ok" });
    }
});

app.delete('/admin/buyurtma/:id', (req, res) => {
    let data = oqish();
    data.buyurtmalar = data.buyurtmalar.filter(b => b._id !== req.params.id);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
