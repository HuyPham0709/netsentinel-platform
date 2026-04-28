const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const DomainTraffic = require('./models/DomainTraffic');
const Device = require('./models/Device');
const Metric = require('./models/Metric');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
let discoveryQueue = [];
app.use(express.json());
app.use(cors());

// --- KẾT NỐI DATABASE (GIỮ NGUYÊN) ---
mongoose.connect('mongodb://localhost:27017/netsentinel')
    .then(() => console.log("--- ✅ Đã kết nối MongoDB thành công ---"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// --- QUẢN LÝ WEBSOCKET (GIỮ NGUYÊN) ---
io.on('connection', (socket) => {
    console.log('[Websocket] Một Client (Frontend) vừa kết nối!');
    socket.on('disconnect', () => {
         console.log('[Websocket] Client đã ngắt kết nối.');
    });
});

// --- HÀM GỬI TIN NHẮN TELEGRAM (GIỮ NGUYÊN) ---
async function sendTelegramAlert(alertMessage) {
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
        if (response.ok) console.log(`[Telegram] ✅ Gửi cảnh báo thành công!`);
    } catch (error) {
        console.error("[Telegram] ❌ Lỗi kết nối API:", error);
    }
}

// ==========================================
// --- LOGIC XỬ LÝ CHUNG (GIỮ ĐÚNG LOGIC CŨ) ---
// ==========================================

async function processDiscovery(data) {
    const { ip, mac, agentId } = data;

    // 1. Lưu vào Database ngay lập tức để đảm bảo dữ liệu an toàn
    await Device.findOneAndUpdate(
        { ip }, 
        { mac, lastSeen: new Date(), agentId }, 
        { upsert: true }
    );

    // 2. Thêm vào hàng đợi hiển thị
    discoveryQueue.push({ ip, mac, time: new Date() });
}
setInterval(() => {
    if (discoveryQueue.length > 0) {
        const nextDevice = discoveryQueue.shift(); // Lấy thiết bị đầu tiên ra
        io.emit('new_device', nextDevice);
        console.log(`[UI] Đã đẩy thiết bị ${nextDevice.ip} lên giao diện.`);
    }
}, 500); // 500ms là tốc độ vừa đủ để mắt người theo dõi kịp
async function processMetrics(data) {
    const newMetric = new Metric(data);
    await newMetric.save();
    
    // Bắn socket cho Frontend với data chuẩn Figma
    io.emit('new_metrics', data); 

    if (data.alerts && data.alerts.length > 0) {
        for (const alert of data.alerts) {
            // Giữ nguyên format Telegram cũ của bạn
            const teleMsg = `*${alert.title || alert.type}*\nSource: ${alert.sourceIp}\nTarget: ${alert.targetIp}\nHD: ${alert.description || alert.message}`;
            await sendTelegramAlert(teleMsg);
        }
    }
}

// ==========================================
// --- CẤU HÌNH gRPC SERVER (MỚI THÊM) ---
// ==========================================

const PROTO_PATH = path.join(__dirname, '../proto/telemetry.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const telemetryProto = grpc.loadPackageDefinition(packageDefinition).netsentinel.v1;

const grpcServer = new grpc.Server();

grpcServer.addService(telemetryProto.TelemetryService.service, {
    ReportDiscovery: async (call, callback) => {
        try {
            await processDiscovery(call.request);
            callback(null, { success: true, message: "gRPC Discovery OK" });
        } catch (err) { callback(err); }
    },
    SendMetrics: async (call, callback) => {
        try {
            // Log call.request để kiểm tra dữ liệu thô từ Go gửi sang
            console.log("Raw gRPC Request:", call.request);

            const mappedData = {
                agentId: call.request.agent_id || "Unknown",
                // Chống undefined: Nếu không có syn_count thì lấy 0
                synCount: call.request.syn_count || 0,
                ackCount: call.request.ack_count || 0,
                bytesPerSec: call.request.bytes_per_sec || 0,
                alerts: call.request.alerts || [],
                // Cấu trúc lồng cho các frontend cũ
                metrics: {
                    synCount: call.request.syn_count || 0,
                    ackCount: call.request.ack_count || 0,
                    bytesPerSec: call.request.bytes_per_sec || 0
                }
            };
            await processMetrics(mappedData);
            callback(null, { success: true, message: "gRPC Metrics OK" });
        } catch (err) { callback(err); }
    }
});

// ==========================================
// --- REST API (GIỮ NGUYÊN ROUTE CŨ) ---
// ==========================================

app.post('/api/discovery', async (req, res) => {
    try {
        await processDiscovery(req.body);
        res.status(200).send("Discovery updated");
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/metrics', async (req, res) => {
    try {
        await processMetrics(req.body);
        res.status(200).send("Processed");
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/metrics/history', async (req, res) => {
    try {
        const history = await Metric.find().sort({ timestamp: -1 }).limit(20);
        res.json(history.reverse());
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/devices', async (req, res) => {
    try {
        const devices = await Device.find();
        res.json(devices);
    } catch (err) { res.status(500).send(err.message); }
});

// --- KHỞI CHẠY SERVER SONG SONG ---
const PORT = 3000;
const GRPC_PORT = 50051;

server.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`[REST] NetSentinel running at port ${PORT}`);
    
    // Khởi chạy gRPC sau khi HTTP Server sẵn sàng
    grpcServer.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) return console.error(err);
        console.log(`[gRPC] Telemetry Service running at port ${port}`);
        console.log(`--------------------------------------------------`);
    });
});