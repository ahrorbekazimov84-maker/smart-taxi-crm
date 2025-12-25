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
const BOT_TOKEN = '8458860332:AAHtNrG7i5q-a-qbR3IBGg16MiWRfXjFbJE';
const bot = new Telegraf(BOT_TOKEN);

// Admin sozlamalari
const ADMIN_AUTH = { login: "admin", pass: "admin123" };

// Ma'lumotlarni o'qish/yozish
const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ buyurtmalar: [], haydovchilar: [] }));
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) { return { buyurtmalar: [], haydovchilar: [] }; }
};
const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// --- TELEGRAM BOT ---
bot.start((ctx) => {
    ctx.reply('🚕 Milliy Taxi botiga xush kelibsiz!', 
    Markup.keyboard([ [Markup.button.locationRequest('📍 Joylashuv yuborish')], ['🚕 Haydovchi bo\'lish'] ]).resize());
});

bot.hears('🚕 Haydovchi bo\'lish', (ctx) => {
    let data = oqish();
    if(!data.haydovchilar.includes(ctx.from.id)) { data.haydovchilar.push(ctx.from.id); saqlash(data); }
    ctx.reply('Siz haydovchilar safiga qo\'shildingiz! ✅');
});

bot.on('location', async (ctx) => {
    const data = oqish();
    const orderId = Date.now().toString();
    const yangi = { 
        _id: orderId, 
        mijoz: ctx.from.first_name, 
        chatId: ctx.from.id, 
        yonalish: "Telegram (Xarita)", 
        mijozLoc: { lat: ctx.message.location.latitude, lon: ctx.message.location.longitude }, 
        holati: 'Kutilmoqda', 
        vaqt: new Date().toLocaleTimeString('uz-UZ') 
    };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    ctx.reply('Buyurtmangiz qabul qilindi! 📥');
    data.haydovchilar.forEach(hId => {
        bot.telegram.sendMessage(hId, `📢 YANGI BUYURTMA!\n📍 Mijoz xaritada`, 
        Markup.inlineKeyboard([[Markup.button.callback('🚕 QABUL QILISH', `accept_${orderId}`)]]));
    });
});

bot.action(/accept_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    let data = oqish();
    const order = data.buyurtmalar.find(b => b._id === orderId);
    if (order && order.holati === 'Kutilmoqda') {
        order.holati = "Yo'lda";
        order.haydovchi = ctx.from.first_name;
        saqlash(data);
        io.emit('yangilash_chiqdi');
        ctx.editMessageText(`Siz buyurtmani qabul qildingiz! ✅`);
        bot.telegram.sendMessage(order.chatId, `Mijoz, haydovchi yo'lga chiqdi! 🚖`);
    }
});

bot.launch();

// --- WEB API ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

app.post('/admin/login', (req, res) => {
    const { login, pass } = req.body;
    if(login === ADMIN_AUTH.login && pass === ADMIN_AUTH.pass) res.status(200).json({status: "ok"});
    else res.status(401).json({status: "error"});
});

app.get('/admin/buyurtmalar', (req, res) => res.json(oqish().buyurtmalar));

app.post('/buyurtma/berish', (req, res) => {
    const data = oqish();
    const yangi = { ...req.body, _id: Date.now().toString(), holati: 'Kutilmoqda', vaqt: new Date().toLocaleTimeString('uz-UZ') };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    res.json(yangi);
});

app.post('/buyurtma/qabul', (req, res) => {
    const { orderId, haydovchiIsm } = req.body;
    let data = oqish();
    const order = data.buyurtmalar.find(b => b._id === orderId);
    if(order) { order.holati = "Yo'lda"; order.haydovchi = haydovchiIsm; saqlash(data); io.emit('yangilash_chiqdi'); }
    res.json({status: "ok"});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
