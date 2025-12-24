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

const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return { buyurtmalar: [] };
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return data ? JSON.parse(data) : { buyurtmalar: [] };
    } catch (e) { return { buyurtmalar: [] }; }
};

const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.get('/admin/buyurtmalar', (req, res) => res.json(oqish().buyurtmalar));

app.post('/buyurtma/berish', (req, res) => {
    const data = oqish();
    const yangi = {
        _id: Date.now().toString(),
        mijoz: req.body.ism,
        yonalish: req.body.yonalish,
        mijozLoc: req.body.mijozLoc,
        holati: 'Kutilmoqda',
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
        order.holati = 'Qabul qilindi';
        order.haydovchi = haydovchiIsm;
        order.haydovchiLoc = haydovchiLoc;
        saqlash(data);
        io.emit('yangilash_chiqdi');
        res.json({ status: "ok", mijozLoc: order.mijozLoc });
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
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

