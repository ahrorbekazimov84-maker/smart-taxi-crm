const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const BOT_TOKEN = '8458860332:AAHtNrG7i5q-a-qbR3IBGg16MiWRfXjFbJE';
const bot = new Telegraf(BOT_TOKEN);
const DATA_FILE = './baza.json';

// Ma'lumotlarni boshqarish
const initData = () => {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: [], users: [] }));
    }
};
initData();

const getData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.use(express.json());
app.use(express.static(__dirname));

// --- TELEGRAM BOT ---
bot.start((ctx) => {
    ctx.reply('🚕 Milliy Taxi!\nRo‘yxatdan o‘tish uchun kontaktingizni yuboring.', 
    Markup.keyboard([[Markup.button.contactRequest('📱 Kontaktni yuborish')]]).resize());
});

bot.on('contact', (ctx) => {
    const data = getData();
    const user = { id: ctx.from.id, name: ctx.from.first_name, tel: ctx.message.contact.phone_number };
    if (!data.users.find(u => u.id === user.id)) data.users.push(user);
    saveData(data);
    ctx.reply(`Rahmat, ${user.name}! Endi buyurtma berishingiz mumkin.`, 
    Markup.keyboard([['📍 Taxi chaqirish']]).resize());
});

bot.hears('📍 Taxi chaqirish', (ctx) => {
    ctx.reply('Hozirgi joylashuvingizni yuboring:', Markup.keyboard([[Markup.button.locationRequest('📍 Joylashuvni yuborish')]]).resize());
});

bot.on('location', (ctx) => {
    const data = getData();
    const user = data.users.find(u => u.id === ctx.from.id);
    const order = {
        id: Date.now(),
        name: user ? user.name : ctx.from.first_name,
        tel: user ? user.tel : 'Noma’lum',
        from: 'Telegram',
        status: 'Kutilmoqda',
        time: new Date().toLocaleTimeString('uz-UZ')
    };
    data.orders.push(order);
    saveData(data);
    io.emit('new_order');
    ctx.reply('Buyurtmangiz qabul qilindi! ✅');
});

bot.launch().catch(err => console.error('Bot launch error:', err));

// --- API ---
app.post('/api/auth', (req, res) => {
    const { tel, role } = req.body;
    // SMS Simulyatsiya
    res.json({ ok: true, code: "1234" });
});

app.get('/api/orders', (req, res) => res.json(getData().orders));

app.post('/api/order-web', (req, res) => {
    const data = getData();
    const order = { ...req.body, id: Date.now(), status: 'Kutilmoqda', time: new Date().toLocaleTimeString('uz-UZ') };
    data.orders.push(order);
    saveData(data);
    io.emit('new_order');
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server: ${PORT}`));
