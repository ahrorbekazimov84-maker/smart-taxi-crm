const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');


const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ahrorbekazimov84_db_user:wTMXsENWRLvFtoXi@crmtaxi.lhiixkq.mongodb.net/crm-taxi?appName=crmtaxi', { useNewUrlParser: true, useUnifiedTopology: true });

const orderSchema = new mongoose.Schema({
    mijoz: String,
    tel: String,
    yonalish: String,
    mijozLoc: { lat: Number, lon: Number },
    holati: String,
    vaqt: String,
    haydovchi: String,
    haydovchiLoc: { lat: Number, lon: Number }
});
const Order = mongoose.model('Order', orderSchema);


app.use(cors());
app.use(express.json());
// Renderda public papkadan statik fayllarni xizmat qilish uchun
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Health check yoki Render uchun asosiy route
app.get('/', (req, res) => {
    res.send('CRM Taxi server is running!');
});

app.get('/admin/buyurtmalar', async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/buyurtma/berish', async (req, res) => {
    try {
        const yangi = new Order({
            mijoz: req.body.ism,
            tel: req.body.tel,
            yonalish: req.body.yonalish,
            mijozLoc: req.body.mijozLoc || { lat: 41.2995, lon: 69.2401 },
            holati: 'Kutilmoqda',
            vaqt: new Date().toLocaleTimeString('uz-UZ')
        });
        await yangi.save();
        io.emit('yangilash_chiqdi');
        io.emit('yangi_buyurtma', yangi);
        res.json(yangi);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/buyurtma/qabul', async (req, res) => {
    try {
        const { orderId, haydovchiIsm, haydovchiLoc } = req.body;
        const order = await Order.findByIdAndUpdate(orderId, {
            holati: 'Qabul qilindi',
            haydovchi: haydovchiIsm,
            haydovchiLoc
        }, { new: true });
        if (order) {
            io.emit('yangilash_chiqdi');
            res.json({ status: "ok", mijozLoc: order.mijozLoc });
        } else {
            res.status(404).json({ error: 'Order not found' });
        }
    } catch (error) {
        console.error('Error accepting order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/admin/buyurtma/:id', async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        io.emit('yangilash_chiqdi');
        res.json({ status: "ok" });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Auth endpoint
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (username === 'admin' && password === 'admin123') {
            const token = jwt.sign({ role: 'admin' }, 'secretkey');
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: ${PORT}`));