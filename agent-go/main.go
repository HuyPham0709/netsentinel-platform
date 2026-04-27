package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
)

// --- Cấu hình hệ thống ---
const (
	AgentID   = "win-agent-01"
	ServerURL = "http://localhost:3000"

	// Ngưỡng lọc nhiễu (Noise Filtering)
	MinTrafficThreshold   = 512 * 1024 // 500 KB/s - Dưới mức này sẽ không xét vọt băng thông
	SensitivityMultiplier = 5          // Gấp 5 lần trung bình mới báo động
	MinSynFloodThreshold  = 150        // Ít nhất 150 gói SYN/5s từ 1 IP mới nghi ngờ tấn công
	SynAckRatioThreshold  = 5          // Lượng SYN phải gấp 5 lần ACK
)

var (
	totalSynCount int
	totalAckCount int
	totalBytes    int

	// Theo dõi IP để phát hiện tấn công có mục tiêu
	synPerIP = make(map[string]int)
	ackPerIP = make(map[string]int)

	// Lịch sử băng thông để tính ngưỡng động
	historyBps []int

	dataMutex sync.Mutex
)

func main() {
	// Card mạng của bạn
	deviceName := "\\Device\\NPF_{C4A4D568-AFDD-490D-AA01-782922AFFCCB}"

	fmt.Printf("[*] Khởi động NetSentinel Agent (%s)...\n", AgentID)

	handle, err := pcap.OpenLive(deviceName, 1600, true, pcap.BlockForever)
	if err != nil {
		log.Fatalf("Lỗi mở card mạng: %v", err)
	}
	defer handle.Close()

	// Bộ lọc BPF: Chỉ bắt các gói tin quan trọng để tối ưu CPU
	bpfFilter := "arp or tcp"
	if err := handle.SetBPFFilter(bpfFilter); err != nil {
		log.Fatalf("Lỗi cài đặt BPF Filter: %v", err)
	}

	fmt.Println("[+] Hệ thống đang chạy ở chế độ Hardened (Chống báo giả)...")
	fmt.Println("--------------------------------------------------")

	// Chạy luồng gửi dữ liệu định kỳ
	go startMetricsSender()

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	for packet := range packetSource.Packets() {
		processPacket(packet)
	}
}

// Xử lý từng gói tin nhận được
func processPacket(packet gopacket.Packet) {
	// 1. Discovery (ARP)
	if arpLayer := packet.Layer(layers.LayerTypeARP); arpLayer != nil {
		arp := arpLayer.(*layers.ARP)
		if arp.Operation == layers.ARPRequest || arp.Operation == layers.ARPReply {
			go sendDiscoveryToServer(net.IP(arp.SourceProtAddress).String(), net.HardwareAddr(arp.SourceHwAddress).String())
		}
	}

	dataMutex.Lock()
	defer dataMutex.Unlock()

	// 2. Tính toán Bytes
	totalBytes += len(packet.Data())

	// 3. Phân tích IP và TCP Flags
	var srcIP string
	if ipLayer := packet.Layer(layers.LayerTypeIPv4); ipLayer != nil {
		ip := ipLayer.(*layers.IPv4)
		srcIP = ip.SrcIP.String()
	}

	if tcpLayer := packet.Layer(layers.LayerTypeTCP); tcpLayer != nil {
		tcp := tcpLayer.(*layers.TCP)
		if tcp.SYN && !tcp.ACK {
			totalSynCount++
			if srcIP != "" {
				synPerIP[srcIP]++
			}
		} else if tcp.ACK && !tcp.SYN {
			totalAckCount++
			if srcIP != "" {
				ackPerIP[srcIP]++
			}
		}
	}
}

// Luồng gửi dữ liệu lên Server mỗi 5 giây
func startMetricsSender() {
	ticker := time.NewTicker(1 * time.Second)
	for range ticker.C {
		dataMutex.Lock()
		currentBps := totalBytes / 1
		alerts := []map[string]string{} // Format mới

		// --- THUẬT TOÁN 1: PHÁT HIỆN BĂNG THÔNG ---
		avgBps := getAverage(historyBps)
		if len(historyBps) >= 5 && currentBps > MinTrafficThreshold {
			if currentBps > (avgBps * SensitivityMultiplier) {
				alerts = append(alerts, map[string]string{
					"title":       "Băng thông tăng vọt",
					"sourceIp":    AgentID, // Hoặc lấy IP máy hiện tại
					"targetIp":    "Hệ thống",
					"description": fmt.Sprintf("Lưu lượng %s vượt mức trung bình %s", formatBytes(currentBps), formatBytes(avgBps)),
					"type":        "warning",
				})
			}
		}

		// --- THUẬT TOÁN 2: PHÁT HIỆN SYN FLOOD ---
		for ip, synCount := range synPerIP {
			ackCount := ackPerIP[ip]
			if synCount > MinSynFloodThreshold && synCount > (ackCount*SynAckRatioThreshold) {
				alerts = append(alerts, map[string]string{
					"title":       "Nghi vấn SYN Flood",
					"sourceIp":    ip,
					"targetIp":    "Máy chủ",
					"description": fmt.Sprintf("Phát hiện %d gói SYN không có hồi đáp từ IP này", synCount),
					"type":        "critical",
				})
			}
		}
		// Sao chép dữ liệu để gửi và Reset
		cSyn, cAck, cBps := totalSynCount, totalAckCount, currentBps
		totalSynCount, totalAckCount, totalBytes = 0, 0, 0
		synPerIP = make(map[string]int)
		ackPerIP = make(map[string]int)
		dataMutex.Unlock()

		sendMetricsToServer(cSyn, cAck, cBps, alerts)
	}
}

// --- CÁC HÀM HỖ TRỢ (HELPER FUNCTIONS) ---

func getAverage(arr []int) int {
	if len(arr) == 0 {
		return 0
	}
	sum := 0
	for _, v := range arr {
		sum += v
	}
	return sum / len(arr)
}

func formatBytes(b int) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d Bps", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cBps", float64(b)/float64(div), "KMGTPE"[exp])
}

func sendDiscoveryToServer(ip string, mac string) {
	payload := map[string]string{"ip": ip, "mac": mac, "agentId": AgentID}
	jsonData, _ := json.Marshal(payload)
	http.Post(ServerURL+"/api/discovery", "application/json", bytes.NewBuffer(jsonData))
}

func sendMetricsToServer(syn, ack, bps int, alerts []map[string]string) {
	payload := map[string]interface{}{
		"agentId": AgentID,
		"metrics": map[string]interface{}{
			"synCount":    syn,
			"ackCount":    ack,
			"bytesPerSec": bps,
		},
		"alerts": alerts,
	}
	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(ServerURL+"/api/metrics", "application/json", bytes.NewBuffer(jsonData))
	if err == nil {
		timestamp := time.Now().Format("15:04:05")
		if len(alerts) > 0 {
			fmt.Printf("[!] %s - PHÁT HIỆN NGUY HIỂM: Đã bắn cảnh báo Telegram!\n", timestamp)
		} else {
			fmt.Printf("[%s] Metrics -> Traffic: %s | SYN: %d | ACK: %d\n", timestamp, formatBytes(bps), syn, ack)
		}
		resp.Body.Close()
	}
}
