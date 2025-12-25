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
    try {
        if (!fs.existsSync(DATA_FILE)) return { buyurtmalar: [] };
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return content ? JSON.parse(content) : { buyurtmalar: [] };
    } catch (e) { return { buyurtmalar: [] }; }
};

const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.post('/auth/send-code', (req, res) => {
    const code = Math.floor(1000 + Math.random() * 9000);
    console.log(`[SMS] Tel: ${req.body.tel}, Kod: ${code}`);
    res.json({ status: "sent", debug_code: code });
});

app.post('/admin/login', (req, res) => {
    const { login, pass } = req.body;
    if (login === ADMIN_CONF.login && pass === ADMIN_CONF.pass) res.json({ status: "ok" });
    else res.status(401).json({ status: "error" });
});

app.get('/admin/buyurtmalar', (req, res) => res.json(oqish().buyurtmalar));

app.post('/buyurtma/berish', (req, res) => {
    const data = oqish();
    const yangi = {
        _id: Date.now().toString(),
        mijoz: req.body.tel,
        tel: req.body.tel,
        yonalish: req.body.yonalish,
        mijozLoc: req.body.mijozLoc,
        holati: 'Kutilmoqda',
        haydovchi: null,
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
        io.emit('yangilash_chiqdi');
        res.json({ status: "ok" });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server started on ${PORT}`));
