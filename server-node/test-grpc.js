const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// 1. Load Protobuf
const PROTO_PATH = path.join(__dirname, '../proto/telemetry.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const telemetryProto = grpc.loadPackageDefinition(packageDefinition).netsentinel.v1;

// 2. Khởi tạo Client kết nối tới cổng 50051
const client = new telemetryProto.TelemetryService(
    'localhost:50051', 
    grpc.credentials.createInsecure()
);

// 3. Test gửi Metrics
const mockData = {
    agent_id: "TEST_AGENT_001",
    syn_count: 150,
    ack_count: 140,
    bytes_per_sec: 5000,
    alerts: [
        { type: "TCP_FLOOD", message: "Phát hiện lưu lượng bất thường từ script test" }
    ]
};

console.log("[...] Đang gửi dữ liệu test qua gRPC...");
client.SendMetrics(mockData, (err, response) => {
    if (err) {
        console.error("[-] Lỗi kết nối gRPC:", err);
    } else {
        console.log("[+] Server phản hồi:", response.message);
        console.log("[!] Hãy kiểm tra MongoDB hoặc Dashboard để xác nhận dữ liệu.");
    }
});