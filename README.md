# 🛰️ NetSentinel
**Distributed Network Telemetry & Packet Analyzer Platform**

NetSentinel is a distributed monitoring system built to track real-time network traffic and detect basic security anomalies. It utilizes a high-performance micro-agent architecture to monitor network flows without requiring local software like Wireshark on every machine.

---

## 🎯 Project Objectives
* **Micro-agent Architecture**: Decouples high-performance data collection (Agent) from centralized processing and visualization (Server).
* **Performance Optimized**: Uses **Golang** for low-level packet sniffing and **Node.js** for efficient asynchronous I/O and real-time APIs.
* **Bandwidth Efficiency**: Agents process data locally, only sending periodic metrics and flows to the server to save bandwidth.

## 🏗️ System Architecture
* **Sensor Agent (Golang)**: Captures low-level packets using `gopacket`, sending JSON telemetry every 5-10 seconds.
* **Central Server (Node.js)**: Manages data storage (MongoDB/InfluxDB) and distributes real-time updates via WebSockets.
* **Frontend Client (React/Vue)**: An interactive dashboard for live traffic visualization and dynamic network topology.

## ✨ Key Features
* **🌐 L2 Discovery & Topology**: Automatically maps local network devices by sniffing ARP broadcasts.
* **📈 Traffic Anomaly Detection**: Monitors bandwidth spikes and detects basic TCP SYN Flood attacks.
* **🔍 SNI & DNS Analysis**: Identifies visited domains in HTTPS traffic by inspecting TLS SNI fields and DNS queries.
* **🔔 Multi-channel Alerting**: Real-time notifications for critical events delivered via Telegram or Slack webhooks.

---

## 📂 Project Structure
```text
NetSentinel/
├── agent-go/                 # Sensor Agent (Golang)
│   ├── cmd/                  # Entrypoint (main.go)
│   └── pkg/                  # Sniffer, Analyzer, and Sender logic
├── server-node/              # Central Server (Node.js/Express)
│   ├── src/                  # Controllers, Sockets, and Services
│   └── package.json
└── client-web/               # Frontend Dashboard (React/Vue)
    ├── src/                  # UI Components and Topology Views
    └── package.json
