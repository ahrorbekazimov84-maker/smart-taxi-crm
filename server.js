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
const ADMIN_AUTH = { login: "admin", pass: "admin123" };

const oqish = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ buyurtmalar: [], foydalanuvchilar: [] }));
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) { return { buyurtmalar: [], foydalanuvchilar: [] }; }
};
const saqlash = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// --- TELEGRAM BOT (RO'YXATDAN O'TISH VA BUYURTMA) ---
bot.start((ctx) => {
    ctx.reply('🚕 Milliy Taxi tizimiga xush kelibsiz!\nBuyurtma berish uchun telefon raqamingizni yuboring:', 
    Markup.keyboard([[Markup.button.contactRequest('📱 Telefon raqamni yuborish')]]).resize());
});

bot.on('contact', (ctx) => {
    const tel = ctx.message.contact.phone_number;
    const ism = ctx.message.contact.first_name;
    let data = oqish();
    
    // Foydalanuvchini saqlash
    const user = { chatId: ctx.from.id, ism, tel, roli: 'yolovchi' };
    if (!data.foydalanuvchilar.find(u => u.chatId === ctx.from.id)) {
        data.foydalanuvchilar.push(user);
        saqlash(data);
    }

    ctx.reply(`Rahmat ${ism}! Endi buyurtma berishingiz mumkin.`, 
    Markup.keyboard([['📍 Taxi chaqirish'], ['🚕 Haydovchi bo\'lish']]).resize());
});

bot.hears('📍 Taxi chaqirish', (ctx) => {
    ctx.reply('Hozirgi joylashuvingizni yuboring:', Markup.keyboard([[Markup.button.locationRequest('📍 Joylashuvni yuborish')]]).resize());
});

bot.on('location', async (ctx) => {
    const data = oqish();
    const user = data.foydalanuvchilar.find(u => u.chatId === ctx.from.id);
    if(!user) return ctx.reply('Avval ro\'yxatdan o\'ting (Kontaktni yuboring)');

    const orderId = Date.now().toString();
    const yangi = {
        _id: orderId,
        mijoz: user.ism,
        tel: user.tel,
        yonalish: "Telegram (Xarita)",
        mijozLoc: { lat: ctx.message.location.latitude, lon: ctx.message.location.longitude },
        holati: 'Kutilmoqda',
        vaqt: new Date().toLocaleTimeString('uz-UZ')
    };
    data.buyurtmalar.push(yangi);
    saqlash(data);
    io.emit('yangilash_chiqdi');
    ctx.reply('Buyurtmangiz qabul qilindi! Haydovchi topilganda xabar beramiz. 📥');
});

bot.launch();

// --- WEB API ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// SMS Simulyatsiya (Kod yuborish)
app.post('/api/send-code', (req, res) => {
    const { tel } = req.body;
    // Haqiqiy tizimda bu yerda SMS ketadi. Hozircha kod: 1234
    res.json({ message: "Kod yuborildi: 1234" });
});

app.post('/api/verify-code', (req, res) => {
    const { tel, code, ism, role } = req.body;
    if (code === "1234") {
        let data = oqish();
        if(!data.foydalanuvchilar.find(u => u.tel === tel)) {
            data.foydalanuvchilar.push({ tel, ism, roli: role });
            saqlash(data);
        }
        res.json({ status: "ok" });
    } else {
        res.status(400).json({ status: "error" });
    }
});

app.post('/admin/login', (req, res) => {
    const { login, pass } = req.body;
    if(login === ADMIN_AUTH.login && pass === ADMIN_AUTH.pass) res.json({status: "ok"});
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server: ${PORT}`));
