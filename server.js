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

// Baza funksiyalari
const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ buyurtmalar: [], haydovchilar: [] }));
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(content);
    } catch (e) { return { buyurtmalar: [], haydovchilar: [] }; }
};
const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// BOT LOGIKASI
bot.start((ctx) => {
    ctx.reply(`Assalomu alaykum ${ctx.from.first_name}! 🚕\nTaxi kerak bo'lsa joylashuv yuboring.`, 
    Markup.keyboard([
        [Markup.button.locationRequest('📍 Joylashuvni yuborish'), '🚕 Haydovchi bo\'lish']
    ]).resize());
});

bot.hears('🚕 Haydovchi bo\'lish', (ctx) => {
    let data = oqish();
    if(!data.haydovchilar.includes(ctx.from.id)) {
        data.haydovchilar.push(ctx.from.id);
        saqlash(data);
    }
    ctx.reply('Siz haydovchi sifatida ro\'yxatdan o\'tdingiz! ✅');
});

bot.on('location', async (ctx) => {
    const data = oqish();
    const orderId = Date.now().toString();
    const yangi = {
        _id: orderId,
        mijoz: ctx.from.first_name,
        chatId: ctx.from.id,
        yonalish: "Telegramdan (Xaritada)",
        mijozLoc: { lat: ctx.message.location.latitude, lon: ctx.message.location.longitude },
        holati: 'Kutilmoqda',
        vaqt: new Date().toLocaleTimeString('uz-UZ')
    };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    ctx.reply('Buyurtmangiz yuborildi! 📥');
    
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
        saqlash(data);
        io.emit('yangilash_chiqdi');
        ctx.editMessageText(`Siz buyurtmani oldingiz! ✅`);
        bot.telegram.sendMessage(order.chatId, `Sizga haydovchi yo'lga chiqdi! 🚖`);
    }
});

bot.launch();

// WEB
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

app.get('/admin/buyurtmalar', (req, res) => res.json(oqish().buyurtmalar));
app.post('/buyurtma/berish', (req, res) => {
    const data = oqish();
    const yangi = { ...req.body, _id: Date.now().toString(), holati: 'Kutilmoqda', vaqt: new Date().toLocaleTimeString('uz-UZ') };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    res.json(yangi);
});

// RENDER UCHUN PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server: http://localhost:${PORT}`);
});

