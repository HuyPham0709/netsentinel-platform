const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // Thư viện lõi của Node.js
const { Server } = require('socket.io'); // Import Socket.io

const Device = require('./models/Device');
const Metric = require('./models/Metric');

const app = express();
const server = http.createServer(app); // Khởi tạo HTTP Server
const io = new Server(server, {       // Khởi tạo Websocket Server
    cors: { origin: "*" }             // Cho phép mọi Frontend kết nối tới
});

app.use(express.json());
app.use(cors());

mongoose.connect('mongodb://localhost:27017/netsentinel')
    .then(() => console.log("--- Connected to MongoDB ---"))
    .catch(err => console.error("Could not connect to MongoDB", err));

io.on('connection', (socket) => {
    console.log('[Websocket] Một Client (Frontend) vừa kết nối!');
    socket.on('disconnect', () => {
         console.log('[Websocket] Client đã ngắt kết nối.');
    });
});

app.post('/api/discovery', async (req, res) => {
    const { ip, mac, agentId } = req.body;
    try {
        await Device.findOneAndUpdate(
            { ip }, 
            { mac, lastSeen: new Date(), agentId }, 
            { upsert: true }
        );
        io.emit('new_device', { ip, mac, time: new Date() }); 
        res.status(200).send("Discovery updated");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/metrics', async (req, res) => {
    try {
        const newMetric = new Metric(req.body);
        await newMetric.save();
        io.emit('new_metrics', req.body); 
        
        res.status(200).send("Metrics saved");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`[Server] NetSentinel API & Websocket đang chạy tại http://localhost:${PORT}`);
});