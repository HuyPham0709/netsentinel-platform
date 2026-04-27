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

const (
	AgentID   = "win-agent-01"
	ServerURL = "http://localhost:3000"
)

var (
	totalSynCount int
	totalAckCount int
	totalBytes    int

	// Đếm SYN/ACK phân loại theo từng IP cụ thể
	synPerIP = make(map[string]int)
	ackPerIP = make(map[string]int)

	// Mảng lưu lịch sử băng thông 10 phút (120 phần tử x 5s)
	historyBps []int

	dataMutex sync.Mutex
)

func main() {
	// THAY BẰNG TÊN CARD MẠNG CỦA BẠN
	deviceName := "\\Device\\NPF_{C4A4D568-AFDD-490D-AA01-782922AFFCCB}"

	fmt.Printf("[*] Đang khởi động NetSentinel Agent (%s)...\n", AgentID)

	handle, err := pcap.OpenLive(deviceName, 1600, true, pcap.BlockForever)
	if err != nil {
		log.Fatalf("Lỗi mở card mạng: %v", err)
	}
	defer handle.Close()

	// Bộ lọc BPF tối ưu hiệu năng
	bpfFilter := "arp or udp port 53 or tcp port 443"
	err = handle.SetBPFFilter(bpfFilter)
	if err != nil {
		log.Fatalf("Lỗi cài đặt BPF Filter: %v", err)
	}

	fmt.Println("[+] Sẵn sàng! Đang phân tích bất thường mạng (Traffic Monitoring & Anomaly Detection)...")
	fmt.Println("--------------------------------------------------")

	go startMetricsSender()

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())

	for packet := range packetSource.Packets() {
		// 1. Gửi thông tin thiết bị (L2 Discovery)
		if arpLayer := packet.Layer(layers.LayerTypeARP); arpLayer != nil {
			arp := arpLayer.(*layers.ARP)
			if arp.Operation == layers.ARPRequest || arp.Operation == layers.ARPReply {
				go sendDiscoveryToServer(net.IP(arp.SourceProtAddress).String(), net.HardwareAddr(arp.SourceHwAddress).String())
			}
		}

		dataMutex.Lock()

		// 2. Tính toán lưu lượng (Bytes)
		totalBytes += len(packet.Data())

		// Bóc tách IP Nguồn
		var srcIP string
		if ipLayer := packet.Layer(layers.LayerTypeIPv4); ipLayer != nil {
			ip := ipLayer.(*layers.IPv4)
			srcIP = ip.SrcIP.String()
		}

		// 3. Phân loại TCP SYN / ACK
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
		dataMutex.Unlock()
	}
}

func sendDiscoveryToServer(ip string, mac string) {
	payload := map[string]string{"ip": ip, "mac": mac, "agentId": AgentID}
	jsonData, _ := json.Marshal(payload)
	http.Post(ServerURL+"/api/discovery", "application/json", bytes.NewBuffer(jsonData))
}

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

func startMetricsSender() {
	ticker := time.NewTicker(5 * time.Second)
	for range ticker.C {
		dataMutex.Lock()

		currentBps := totalBytes / 5
		alerts := []map[string]string{}

		// ==========================================
		// THUẬT TOÁN 1: BANDWIDTH SPIKE DETECTION
		// ==========================================
		avgBps := getAverage(historyBps)
		// Cảnh báo nếu > 3 lần trung bình VÀ traffic tối thiểu > 10KB/s
		if avgBps > 0 && currentBps > (avgBps*3) && currentBps > 10240 {
			alerts = append(alerts, map[string]string{
				"type":    "Bandwidth Spike",
				"message": fmt.Sprintf("Băng thông tăng vọt: %d Bps (Bình thường: %d Bps)", currentBps, avgBps),
			})
		}

		// Cập nhật lịch sử (120 chu kỳ = 10 phút)
		historyBps = append(historyBps, currentBps)
		if len(historyBps) > 120 {
			historyBps = historyBps[1:]
		}

		// ==========================================
		// THUẬT TOÁN 2: BASIC SYN FLOOD (Dựa trên tỷ lệ)
		// ==========================================
		for ip, synCount := range synPerIP {
			ackCount := ackPerIP[ip]
			// Ngưỡng: IP có > 30 gói SYN/5s VÀ lượng SYN gấp 3 lần lượng ACK
			if synCount > 30 && synCount > (ackCount*3) {
				alerts = append(alerts, map[string]string{
					"type":    "SYN Flood Suspicion",
					"message": fmt.Sprintf("IP %s liên tục gửi SYN (%d gói) nhưng thiếu ACK trả về (%d gói)", ip, synCount, ackCount),
				})
			}
		}

		// Lấy dữ liệu gửi đi và reset
		cSyn, cAck, cBps := totalSynCount, totalAckCount, currentBps
		totalSynCount, totalAckCount, totalBytes = 0, 0, 0
		synPerIP = make(map[string]int)
		ackPerIP = make(map[string]int)
		dataMutex.Unlock()

		// Đóng gói JSON
		payload := map[string]interface{}{
			"agentId": AgentID,
			"metrics": map[string]interface{}{
				"synCount":    cSyn,
				"ackCount":    cAck,
				"bytesPerSec": cBps,
			},
			"alerts": alerts,
		}
		jsonData, _ := json.Marshal(payload)

		// Gửi lên Server
		resp, err := http.Post(ServerURL+"/api/metrics", "application/json", bytes.NewBuffer(jsonData))
		if err == nil {
			if len(alerts) > 0 {
				fmt.Printf("[!] PHÁT HIỆN BẤT THƯỜNG: %d cảnh báo!\n", len(alerts))
				for _, alert := range alerts {
					fmt.Printf("    - [%s] %s\n", alert["type"], alert["message"])
				}
			} else {
				fmt.Printf("[Metrics] Đã gửi -> SYN: %d | ACK: %d | Traffic: %d Bps\n", cSyn, cAck, cBps)
			}
			resp.Body.Close()
		}
	}
}
