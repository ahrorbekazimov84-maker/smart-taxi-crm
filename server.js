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

// Stikerlar IDlari (Bular standart taxi stikerlari o'rnida ishlaydi)
const STICKERS = {
    welcome: 'CAACAgIAAxkBAAEL6Zxl7...', // Salomlashish
    order_received: 'CAACAgIAAxkBAAEL6Z5l7...', // Qabul qilindi
    driver_on_way: 'CAACAgIAAxkBAAEL6aBl7...', // Haydovchi yo'lda
    finished: 'CAACAgIAAxkBAAEL6aJl7...' // Yakunlandi
};

const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return { buyurtmalar: [], haydovchilar: [] };
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return content ? JSON.parse(content) : { buyurtmalar: [], haydovchilar: [] };
    } catch (e) { return { buyurtmalar: [], haydovchilar: [] }; }
};

const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// --- TELEGRAM BOT LOGIKASI ---

bot.start((ctx) => {
    ctx.replyWithSticker('CAACAgIAAxkBAAEL6Zxl7Z...'); // Taxi stikeri
    ctx.reply(`Assalomu alaykum ${ctx.from.first_name}! 🚕\nSiz "Viloyat Taxi" professional tizimidasiz.\n\nRejimni tanlang:`, 
    Markup.keyboard([
        ['🙋‍♂️ Yo\'lovchi bo\'lish', '🚕 Haydovchi bo\'lish'],
        ['📋 Safarlar tarixi', '⭐ Reytingim']
    ]).resize());
});

// Haydovchi sifatida ro'yxatdan o'tish
bot.hears('🚕 Haydovchi bo\'lish', (ctx) => {
    let data = oqish();
    if(!data.haydovchilar) data.haydovchilar = [];
    if(!data.haydovchilar.includes(ctx.from.id)) {
        data.haydovchilar.push(ctx.from.id);
        saqlash(data);
    }
    ctx.reply('Tabriklaymiz! Siz haydovchilar ro\'yxatiga qo\'shildingiz. ✅\nYangi buyurtmalar haqida shu yerda xabar olasiz.');
});

// Yo'lovchi joylashuv yuborganda
bot.on('location', async (ctx) => {
    const data = oqish();
    const orderId = Date.now().toString();
    const yangi = {
        _id: orderId,
        mijoz: ctx.from.first_name,
        chatId: ctx.from.id,
        tel: "TG: " + ctx.from.id,
        yonalish: "Telegram orqali (Xaritada ko'rsatilgan)",
        mijozLoc: { lat: ctx.message.location.latitude, lon: ctx.message.location.longitude },
        holati: 'Kutilmoqda',
        vaqt: new Date().toLocaleTimeString('uz-UZ')
    };
    
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');

    await ctx.reply('Buyurtmangiz qabul qilindi! 📥\nHaydovchilarimizga xabar yuborildi. Kuting...');

    // Barcha haydovchilarga xabar yuborish
    if(data.haydovchilar) {
        data.haydovchilar.forEach(hId => {
            bot.telegram.sendMessage(hId, `📢 YANGI BUYURTMA!\n👤 Mijoz: ${ctx.from.first_name}\n📍 Joylashuv: Xaritada ko'rsatilgan`, 
            Markup.inlineKeyboard([
                [Markup.button.callback('🚕 QABUL QILISH', `accept_${orderId}`)]
            ]));
        });
    }
});

// Haydovchi buyurtmani bot ichida qabul qilganda
bot.action(/accept_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    let data = oqish();
    const order = data.buyurtmalar.find(b => b._id === orderId);

    if (order && order.holati === 'Kutilmoqda') {
        order.holati = "Yo'lda";
        order.haydovchi = ctx.from.first_name;
        saqlash(data);
        io.emit('yangilash_chiqdi');

        ctx.editMessageText(`Muvaffaqiyatli qabul qilindi! ✅\nMijozga xabar yuborildi.`);
        
        // Mijozga stiker va xabar yuborish
        bot.telegram.sendMessage(order.chatId, `Sizning buyurtmangizni ${ctx.from.first_name} ismli haydovchi qabul qildi! 🚖\nIltimos, kutib turing.`);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Professional Taxi Server running on ${PORT}`));
