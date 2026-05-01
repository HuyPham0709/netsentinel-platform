🛰️ NetSentinel
Distributed Network Telemetry & Packet Analyzer Platform

NetSentinel là một nền tảng giám sát mạng phân tán hiện đại, kết hợp sức mạnh xử lý gói tin hiệu năng cao của Golang và khả năng quản lý dữ liệu thời gian thực của Node.js. Hệ thống cho phép theo dõi lưu lượng, trực quan hóa sơ đồ mạng và phát hiện các dấu hiệu bất thường mà không cần cài đặt Wireshark trên từng máy trạm.

📑 Mục lục (Table of Contents)
Mục tiêu dự án (Objectives)

Kiến trúc hệ thống (Architecture)

Tính năng nổi bật (Key Features)

Cấu trúc thư mục (Structure)

Hướng dẫn cài đặt (Installation)

🎯 Mục tiêu dự án (Objectives)
Kiến trúc Micro-agent: Tách biệt tầng thu thập dữ liệu (Agent) và tầng xử lý/hiển thị (Central Server).

Tối ưu hóa hiệu năng: Sử dụng Golang cho việc bắt gói tin tầng thấp và Node.js để xử lý I/O không đồng bộ.

Tiết kiệm băng thông: Agent chỉ gửi các chỉ số (Metrics) đã tổng hợp về Server thay vì gửi gói tin thô, giúp hệ thống hoạt động mượt mà trong mạng lớn.

🏗️ Kiến trúc hệ thống (Architecture)
Sensor Agent (Golang): Sử dụng gopacket để bắt các gói tin ARP, TCP, UDP và ICMP. Tính toán Metrics và gửi về Server qua HTTP/gRPC.

Central Server (Node.js): Nhận dữ liệu, lưu trữ vào MongoDB Timeseries và phân phối cập nhật tới Frontend qua Socket.io.

Frontend Dashboard: Trực quan hóa sơ đồ mạng (Topology) và biểu đồ lưu lượng theo thời gian thực.

✨ Tính năng nổi bật (Key Features)
🌐 L2 Discovery & Topology: Tự động phát hiện thiết bị nội bộ qua bản tin ARP và vẽ sơ đồ mạng động.

📈 Real-time Traffic Monitoring: Theo dõi băng thông (Bytes/s) và các chỉ số SYN/ACK thời gian thực.

🔍 DPI (Deep Packet Inspection): Bóc tách trường SNI từ TLS Client Hello và truy vấn DNS để thống kê các tên miền được truy cập (ngay cả với HTTPS).

🔔 Cảnh báo đa kênh: Tự động gửi cảnh báo qua Telegram khi phát hiện tấn công SYN Flood hoặc lưu lượng tăng đột biến.

🗄️ Timeseries Storage: Lưu trữ dữ liệu hiệu quả với MongoDB Timeseries, hỗ trợ truy vấn lịch sử nhanh chóng.

📂 Cấu trúc thư mục (Structure)
Plaintext
NetSentinel/
├── agent-go/                 # Sensor Agent (Golang)
│   ├── cmd/                  # Entrypoint (main.go)
│   ├── internal/             # Logic: Capture, Analyzer, Sender
│   └── proto/                # Định nghĩa gRPC Protobuf
├── server-node/              # Central Server (Node.js)
│   ├── models/               # MongoDB Schemas (Metric, Device, Domain)
│   ├── app.js                # Main Server (HTTP, gRPC, Socket.io)
│   └── package.json
└── client-web/               # Frontend Dashboard
    ├── src/                  # React/Vue Components
    └── package.json
🛠️ Hướng dẫn cài đặt (Installation)
1. Yêu cầu hệ thống
Golang (1.20+) & Node.js (v16+).

MongoDB (Local hoặc Atlas).

Npcap (Windows) hoặc libpcap (Linux) để bắt gói tin.

2. Clone dự án
Bash
git clone https://github.com/your-username/NetSentinel.git
cd NetSentinel
3. Cài đặt Server (Node.js)
Bash
cd server-node
npm install
# Khởi chạy Server (Mặc định: HTTP 3000, gRPC 50051)
node app.js
4. Cài đặt Agent (Golang)
Bash
cd ../agent-go
go mod tidy
# Chạy Agent với quyền Administrator/Root
go run cmd/main.go
