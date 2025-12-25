const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DATA_FILE = './baza.json';
const ADMIN_CONF = { login: "admin", pass: "taxi777" };

// --- TELEGRAM BOT SOZLAMASI ---
const BOT_TOKEN = '8458860332:AAHtNrG7i5q-a-qbR3IBGg16MiWRfXjFbJE'; 
const bot = new Telegraf(BOT_TOKEN);

const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return { buyurtmalar: [] };
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return content ? JSON.parse(content) : { buyurtmalar: [] };
    } catch (e) { return { buyurtmalar: [] }; }
};

const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// Bot komandalari
bot.start((ctx) => {
    ctx.reply(`Xush kelibsiz, ${ctx.from.first_name}!\nViloyat Taxi tizimiga xush kelibsiz. Taxi chaqirish uchun pastdagi tugmani bosing.`, 
    Markup.keyboard([
        [Markup.button.locationRequest('📍 Joylashuvni yuborish (Buyurtma)')]
    ]).resize());
});

bot.on('location', (ctx) => {
    const data = oqish();
    const yangi = {
        _id: Date.now().toString(),
        mijoz: ctx.from.first_name || "Telegram User",
        tel: "TG: " + ctx.from.id,
        yonalish: "Telegram orqali (Manzil xaritada)",
        mijozLoc: { lat: ctx.message.location.latitude, lon: ctx.message.location.longitude },
        holati: 'Kutilmoqda',
        haydovchi: null,
        vaqt: new Date().toLocaleTimeString('uz-UZ')
    };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    ctx.reply('Rahmat! Buyurtmangiz qabul qilindi. Haydovchilarimiz xaritada sizni ko\'rib turishibdi.');
});

bot.launch().then(() => console.log("Bot ishga tushdi"));

// --- WEB SERVER ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

app.post('/auth/send-code', (req, res) => {
    const code = Math.floor(1000 + Math.random() * 9000);
    console.log(`[SMS SIMITATOR] Tel: ${req.body.tel}, Kod: ${code}`);
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
    const { orderId, haydovchiIsm } = req.body;
    let data = oqish();
    const order = data.buyurtmalar.find(b => b._id === orderId);
    if (order) {
        order.holati = "Yo'lda";
        order.haydovchi = haydovchiIsm;
        saqlash(data);
        io.emit('yangilash_chiqdi');
        res.json({ status: "ok" });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
