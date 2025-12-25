const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const BOT_TOKEN = '8458860332:AAHtNrG7i5q-a-qbR3IBGg16MiWRfXjFbJE';
const bot = new Telegraf(BOT_TOKEN);
const DATA_FILE = './baza.json';

// Ma'lumotlar bazasini tekshirish
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: [], users: [] }));

const db = () => JSON.parse(fs.readFileSync(DATA_FILE));
const save = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.use(express.json());
app.use(express.static(__dirname));

// --- BOT LOGIKASI (Faqat shaxsiy buyurtmalar) ---
bot.start((ctx) => {
    ctx.reply('🚖 Milliy Taxi - O‘zbekiston!\nRo‘yxatdan o‘tish uchun kontaktingizni yuboring:', 
    Markup.keyboard([[Markup.button.contactRequest('📱 Kontaktni yuborish')]]).resize());
});

bot.on('contact', (ctx) => {
    let data = db();
    const user = { id: ctx.from.id, name: ctx.from.first_name, tel: ctx.message.contact.phone_number };
    if (!data.users.find(u => u.id === user.id)) data.users.push(user);
    save(data);
    ctx.reply('✅ Ro‘yxatdan o‘tdingiz!', Markup.keyboard([['📍 Taxi chaqirish'], ['📜 Mening buyurtmalarim']]).resize());
});

bot.hears('📜 Mening buyurtmalarim', (ctx) => {
    const myOrders = db().orders.filter(o => o.userId === ctx.from.id);
    if(myOrders.length === 0) return ctx.reply('Sizda hali buyurtmalar yo‘q.');
    let msg = 'Sizning buyurtmalaringiz:\n\n';
    myOrders.forEach(o => msg += `📅 ${o.time}\n📍 ${o.route}\nHolat: ${o.status}\n---\n`);
    ctx.reply(msg);
});

bot.on('location', (ctx) => {
    let data = db();
    const user = data.users.find(u => u.id === ctx.from.id);
    const order = {
        id: Date.now(),
        userId: ctx.from.id,
        name: user ? user.name : ctx.from.first_name,
        tel: user ? user.tel : 'Noma’lum',
        loc: { lat: ctx.message.location.latitude, lon: ctx.message.location.longitude },
        route: "Telegram Xarita",
        status: 'Kutilmoqda',
        time: new Date().toLocaleString('uz-UZ')
    };
    data.orders.push(order);
    save(data);
    io.emit('update');
    ctx.reply('🚀 Buyurtma qabul qilindi!');
});

bot.launch();

// --- WEB API ---
app.get('/api/orders', (req, res) => res.json(db().orders));

app.post('/api/order-web', (req, res) => {
    let data = db();
    data.orders.push({...req.body, status: 'Kutilmoqda', time: new Date().toLocaleTimeString('uz-UZ')});
    save(data);
    io.emit('update');
    res.json({ok: true});
});

app.post('/api/delete-order', (req, res) => {
    let data = db();
    data.orders = data.orders.filter(o => o.id !== req.body.id);
    save(data);
    io.emit('update');
    res.json({ ok: true });
});

server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Server Ready'));
