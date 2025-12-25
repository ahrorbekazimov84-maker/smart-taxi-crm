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
const BOT_TOKEN = '8458860332:AAHtNrG7i5q-a-qbR3IBGg16MiWRfXjFbJE';
const bot = new Telegraf(BOT_TOKEN);

// Ma'lumotlarni xatosiz o'qish va saqlash
const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return { buyurtmalar: [], haydovchilar: [] };
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(content);
        if (!parsed.buyurtmalar) parsed.buyurtmalar = [];
        if (!parsed.haydovchilar) parsed.haydovchilar = [];
        return parsed;
    } catch (e) { 
        return { buyurtmalar: [], haydovchilar: [] }; 
    }
};

const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// --- TELEGRAM BOT LOGIKASI ---
bot.start((ctx) => {
    ctx.replyWithSticker('CAACAgIAAxkBAAEL6Zxl7Z...'); // Taxi stikeri (Agar ID xato bo'lsa, xabar yuboradi)
    ctx.reply(`Assalomu alaykum ${ctx.from.first_name}! 🚕\n\nViloyat Taxi tizimiga xush kelibsiz. Rejimni tanlang:`, 
    Markup.keyboard([
        ['🙋‍♂️ Yo\'lovchi bo\'lish', '🚕 Haydovchi bo\'lish'],
        ['📋 Safarlar tarixi', '⭐ Reytingim']
    ]).resize());
});

bot.hears('🚕 Haydovchi bo\'lish', (ctx) => {
    let data = oqish();
    if(!data.haydovchilar.includes(ctx.from.id)) {
        data.haydovchilar.push(ctx.from.id);
        saqlash(data);
    }
    ctx.reply('Siz haydovchilar ro\'yxatiga qo\'shildingiz! ✅\nYangi buyurtmalar haqida shu yerda bildirishnoma olasiz.');
});

bot.on('location', async (ctx) => {
    const data = oqish();
    const orderId = Date.now().toString();
    const yangi = {
        _id: orderId,
        mijoz: ctx.from.first_name,
        chatId: ctx.from.id,
        tel: "TG: " + ctx.from.id,
        yonalish: "Telegram Bot (Xaritada)",
        mijozLoc: { lat: ctx.message.location.latitude, lon: ctx.message.location.longitude },
        holati: 'Kutilmoqda',
        vaqt: new Date().toLocaleTimeString('uz-UZ')
    };
    
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');

    await ctx.reply('Buyurtmangiz qabul qilindi! 📥\nHaydovchilarimizga xabar yuborildi.');

    // Haydovchilarga bildirishnoma yuborish
    data.haydovchilar.forEach(hId => {
        bot.telegram.sendMessage(hId, `📢 YANGI BUYURTMA!\n👤 Mijoz: ${ctx.from.first_name}\n📍 Joylashuv: Xaritada`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('🚕 QABUL QILISH', `accept_${orderId}`)]
        ]));
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
        ctx.editMessageText(`Muvaffaqiyatli qabul qilindi! ✅`);
        bot.telegram.sendMessage(order.chatId, `Xushxabar! 🚖\nSizning buyurtmangizni ${ctx.from.first_name} qabul qildi.`);
    } else {
        ctx.answerCbQuery('Bu buyurtma allaqachon olingan! ❌');
    }
});

bot.launch();

// --- WEB SERVER ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

app.get('/admin/buyurtmalar', (req, res) => res.json(oqish().buyurtmalar));

app.post('/admin/login', (req, res) => {
    const { login, pass } = req.body;
    if (login === ADMIN_CONF.login && pass === ADMIN_CONF.pass) res.json({ status: "ok" });
    else res.status(401).json({ status: "error" });
});

// Render uchun muhim qism
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
