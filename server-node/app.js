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

// --- API NHẬN DỮ LIỆU METRICS & CẢNH BÁO (HỢP NHẤT) ---
app.post('/api/metrics', async (req, res) => {
    try {
        // 1. Lưu dữ liệu vào MongoDB
        const newMetric = new Metric(req.body);
        await newMetric.save();
        
        // 2. Bắn dữ liệu Realtime ra Frontend
        io.emit('new_metrics', req.body); 

        // 3. KIỂM TRA VÀ GỬI CẢNH BÁO TELEGRAM
        // req.body.alerts được gửi từ Agent Go
        if (req.body.alerts && req.body.alerts.length > 0) {
            console.log(`[Alert] Phát hiện ${req.body.alerts.length} sự cố từ Agent. Bắt đầu gửi tin nhắn...`);
            
            // Dùng vòng lặp for...of để đảm bảo thứ tự gửi tin
            for (const alert of req.body.alerts) {
                await sendTelegramAlert(`*[${alert.type}]*\n${alert.message}`);
            }
        }
        
        res.status(200).send("Metrics and Alerts processed");
    } catch (err) {
        console.error("[Server Error] Lỗi xử lý Metrics:", err.message);
        res.status(500).send(err.message);
    }
});

// --- KHỞI CHẠY SERVER ---
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`[Server] NetSentinel System đang chạy tại cổng ${PORT}`);
    console.log(`[Server] Sẵn sàng nhận dữ liệu từ Agent Go...`);
    console.log(`--------------------------------------------------`);
});