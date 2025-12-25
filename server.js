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
const DATA_FILE = path.join(__dirname, 'baza.json');

// Baza faylini xavfsiz yaratish
const initDB = () => {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: [], users: [] }));
    }
};
initDB();

const db = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const save = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.use(express.json());
app.use(express.static(__dirname));

// --- BOT LOGIKASI (CRASHdan himoyalangan) ---
bot.start((ctx) => {
    try {
        ctx.reply('🚖 Milliy Taxi - O‘zbekiston!\nRo‘yxatdan o‘tish uchun kontaktingizni yuboring:', 
        Markup.keyboard([[Markup.button.contactRequest('📱 Kontaktni yuborish')]]).resize());
    } catch (e) { console.error(e); }
});

bot.on('contact', (ctx) => {
    try {
        let data = db();
        const contact = ctx.message.contact;
        const user = { id: ctx.from.id, name: contact.first_name, tel: contact.phone_number };
        
        if (!data.users.find(u => u.id === user.id)) {
            data.users.push(user);
            save(data);
        }
        ctx.reply('✅ Ro‘yxatdan o‘tdingiz!', Markup.keyboard([['📍 Taxi chaqirish'], ['📜 Mening buyurtmalarim']]).resize());
    } catch (e) {
        console.error("Bot contact error:", e);
        ctx.reply("Xatolik yuz berdi. Qayta urinib ko'ring.");
    }
});

bot.hears('📜 Mening buyurtmalarim', (ctx) => {
    try {
        const myOrders = db().orders.filter(o => o.userId === ctx.from.id);
        if(myOrders.length === 0) return ctx.reply('Sizda hali buyurtmalar yo‘q.');
        let msg = 'Sizning buyurtmalaringiz:\n\n';
        myOrders.forEach(o => msg += `📅 ${o.time}\n📍 ${o.route}\nHolat: ${o.status}\n---\n`);
        ctx.reply(msg);
    } catch (e) { console.error(e); }
});

bot.on('location', (ctx) => {
    try {
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
    } catch (e) { console.error(e); }
});

// Botni xatolik bilan to'xtab qolmasligi uchun catch qo'shildi
bot.launch().catch(err => console.error("Bot ishga tushmadi:", err));

// --- WEB API ---
app.get('/api/orders', (req, res) => res.json(db().orders));

app.post('/api/order-web', (req, res) => {
    try {
        let data = db();
        data.orders.push({...req.body, status: 'Kutilmoqda', time: new Date().toLocaleTimeString('uz-UZ')});
        save(data);
        io.emit('update');
        res.json({ok: true});
    } catch (e) { res.status(500).json({ok: false}); }
});

app.post('/api/delete-order', (req, res) => {
    try {
        let data = db();
        data.orders = data.orders.filter(o => o.id !== req.body.id);
        save(data);
        io.emit('update');
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ok: false}); }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));

// Render uchun botni to'g'ri to'xtatish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
