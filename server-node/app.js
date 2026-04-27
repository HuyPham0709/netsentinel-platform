const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // Thư viện lõi của Node.js
const { Server } = require('socket.io'); // Import Socket.io
const DomainTraffic = require('./models/DomainTraffic');
const Device = require('./models/Device');
const Metric = require('./models/Metric');

const app = express();
const server = http.createServer(app); // Khởi tạo HTTP Server
const io = new Server(server, {       // Khởi tạo Websocket Server
    cors: { origin: "*" }             // Cho phép mọi Frontend kết nối tới
});

app.use(express.json());
app.use(cors());

// --- KẾT NỐI DATABASE ---
mongoose.connect('mongodb://localhost:27017/netsentinel')
    .then(() => console.log("--- ✅ Đã kết nối MongoDB thành công ---"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// --- QUẢN LÝ WEBSOCKET ---
io.on('connection', (socket) => {
    console.log('[Websocket] Một Client (Frontend) vừa kết nối!');
    socket.on('disconnect', () => {
         console.log('[Websocket] Client đã ngắt kết nối.');
    });
});

// --- HÀM GỬI TIN NHẮN TELEGRAM ---
async function sendTelegramAlert(alertMessage) {
    // Thông tin Bot của bạn
    const botToken = '8737388210:AAHCxR4mxx_gx_yde9w0iaQSsiwkeJ3inBg'; 
    const chatId = '8673923447'; 
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: `🚨 *NetSentinel Security Alert*\n\n⚠️ ${alertMessage}\n⏱ Thời gian: ${new Date().toLocaleString('vi-VN')}`,
                parse_mode: 'Markdown'
            })
        });

        if (response.ok) {
            console.log(`[Telegram] ✅ Gửi cảnh báo thành công!`);
        } else {
            const errorData = await response.json();
            console.error(`[Telegram] ❌ Bot phản hồi lỗi:`, errorData.description);
        }
    } catch (error) {
        console.error("[Telegram] ❌ Lỗi kết nối API:", error);
    }
}

// --- API DISCOVERY (NHẬN THÔNG TIN THIẾT BỊ) ---
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

app.get('/api/metrics/history', async (req, res) => {
    try {
        const history = await Metric.find()
            .sort({ timestamp: -1 })
            .limit(20); // Lấy 20 điểm dữ liệu gần nhất cho Sparkline
        res.json(history.reverse()); // Đảo ngược lại để vẽ từ trái sang phải
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- CẬP NHẬT API NHẬN METRICS ---
app.post('/api/metrics', async (req, res) => {
    try {
        const newMetric = new Metric(req.body);
        await newMetric.save();
        
        // Bắn socket cho Frontend với data chuẩn Figma
        io.emit('new_metrics', req.body); 

        if (req.body.alerts && req.body.alerts.length > 0) {
            for (const alert of req.body.alerts) {
                // Gửi Telegram với format chi tiết hơn
                const teleMsg = `*${alert.title}*\nSource: ${alert.sourceIp}\nTarget: ${alert.targetIp}\nHD: ${alert.description}`;
                await sendTelegramAlert(teleMsg);
            }
        }
        res.status(200).send("Processed");
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await Device.find();
        res.json(devices);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.post('/api/v1/agents/traffic-batch', async (req, res) => {
    try {
        const { agentId, timestamp, trafficData } = req.body;
        
        // Chuẩn bị mảng dữ liệu để bulk insert
        const records = trafficData.map(item => ({
            timestamp: timestamp || new Date(),
            agentId: agentId,
            domain: item.domain,
            source: item.source,
            hitCount: item.hitCount,
            totalBytes: item.totalBytes
        }));

        await DomainTraffic.insertMany(records);
        
        // (Tùy chọn) Bắn socket cho Frontend nếu cần vẽ Real-time query
        // io.emit('new_domain_traffic', records);

        res.status(202).send("Batch processed");
    } catch (err) {
        console.error("Lỗi xử lý traffic batch:", err);
        res.status(500).send(err.message);
    }
});
app.get('/api/v1/analytics/top-domains', async (req, res) => {
    
});
// --- KHỞI CHẠY SERVER ---
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`[Server] NetSentinel System đang chạy tại cổng ${PORT}`);
    console.log(`[Server] Sẵn sàng nhận dữ liệu từ Agent Go...`);
    console.log(`--------------------------------------------------`);
});