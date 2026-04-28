const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const Device = require('../models/Device');
const Metric = require('../models/Metric');

// Load file .proto tự động (Không cần compile như Go)
const PROTO_PATH = path.join(__dirname, '../../proto/telemetry.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const telemetryProto = grpc.loadPackageDefinition(packageDefinition).netsentinel.v1;

// Hàm khởi tạo gRPC Server, nhận vào đối tượng 'io' (Websocket) từ app.js
function startGrpcServer(io, sendTelegramAlert) {
    const grpcServer = new grpc.Server();

    grpcServer.addService(telemetryProto.TelemetryService.service, {
        
        // 1. Lắng nghe Agent gửi ARP Discovery
        ReportDiscovery: async (call, callback) => {
            try {
                const data = call.request;
                await Device.findOneAndUpdate(
                    { ip: data.ip }, 
                    { mac: data.mac, lastSeen: new Date(), agentId: data.agentId }, 
                    { upsert: true }
                );
                // Đẩy real-time lên Frontend
                io.emit('new_device', { ip: data.ip, mac: data.mac, time: new Date() }); 
                callback(null, { success: true, message: "Discovery saved via gRPC" });
            } catch (err) {
                console.error("[gRPC] Lỗi ReportDiscovery:", err);
                callback({ code: grpc.status.INTERNAL, details: err.message });
            }
        },

        // 2. Lắng nghe Agent gửi Metrics
        SendMetrics: async (call, callback) => {
            try {
                const data = call.request;
                const newMetric = new Metric({
                    agentId: data.agentId,
                    synCount: data.synCount,
                    ackCount: data.ackCount,
                    bytesPerSec: data.bytesPerSec
                });
                await newMetric.save();
                
                io.emit('new_metrics', newMetric);

                // Xử lý cảnh báo Telegram
                if (data.alerts && data.alerts.length > 0) {
                    for (const alert of data.alerts) {
                        const teleMsg = `*${alert.type}*\n${alert.message}`;
                        await sendTelegramAlert(teleMsg);
                    }
                }
                callback(null, { success: true, message: "Metrics saved via gRPC" });
            } catch (err) {
                console.error("[gRPC] Lỗi SendMetrics:", err);
                callback({ code: grpc.status.INTERNAL, details: err.message });
            }
        }
    });

    const port = 50051;
    grpcServer.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
        if (err) throw err;
        console.log(`[gRPC] Hệ thống viễn trắc (Telemetry) đang lắng nghe Agent tại cổng ${boundPort}`);
    });
}

module.exports = startGrpcServer;