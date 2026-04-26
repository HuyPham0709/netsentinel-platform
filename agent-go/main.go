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

// Cấu hình Agent
const (
	AgentID   = "win-agent-01"
	ServerURL = "http://localhost:3000"
)

// Các biến toàn cục để gom (buffer) dữ liệu trong 5 giây
var (
	synCount   int
	ackCount   int
	dnsQueries []string
	dataMutex  sync.Mutex // Đảm bảo an toàn khi đọc/ghi dữ liệu ở tốc độ cao
)

func main() {
	// Thay bằng tên thiết bị của bạn
	deviceName := "\\Device\\NPF_{C4A4D568-AFDD-490D-AA01-782922AFFCCB}"

	fmt.Printf("[*] Đang khởi động NetSentinel Agent (%s)...\n", AgentID)

	handle, err := pcap.OpenLive(deviceName, 1600, true, pcap.BlockForever)
	if err != nil {
		log.Fatalf("Lỗi mở card mạng: %v", err)
	}
	defer handle.Close()

	// ÁP DỤNG BPF FILTER
	bpfFilter := "arp or udp port 53 or tcp port 443"
	err = handle.SetBPFFilter(bpfFilter)
	if err != nil {
		log.Fatalf("Lỗi cài đặt BPF Filter: %v", err)
	}

	fmt.Println("[+] Sẵn sàng! Đang lắng nghe mạng và gửi dữ liệu về Server...")
	fmt.Println("--------------------------------------------------")

	// Khởi chạy 1 luồng chạy ngầm (Goroutine) cứ 5 giây gửi Metrics 1 lần
	go startMetricsSender()

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())

	// Vòng lặp chính: Bắt và bóc tách gói tin
	for packet := range packetSource.Packets() {
		// --- 1. L2 DISCOVERY (ARP) ---
		if arpLayer := packet.Layer(layers.LayerTypeARP); arpLayer != nil {
			arp := arpLayer.(*layers.ARP)
			if arp.Operation == layers.ARPRequest || arp.Operation == layers.ARPReply {
				srcIP := net.IP(arp.SourceProtAddress).String()
				srcMAC := net.HardwareAddr(arp.SourceHwAddress).String()

				// Gửi trực tiếp thông tin thiết bị lên Server trên một luồng riêng
				go sendDiscoveryToServer(srcIP, srcMAC)
			}
		}

		// Khóa Mutex để cập nhật biến đếm an toàn
		dataMutex.Lock()

		// --- 2. DNS ANALYSIS ---
		if dnsLayer := packet.Layer(layers.LayerTypeDNS); dnsLayer != nil {
			dns := dnsLayer.(*layers.DNS)
			if !dns.QR {
				for _, q := range dns.Questions {
					domain := string(q.Name)
					dnsQueries = append(dnsQueries, domain)
					// fmt.Printf("[DNS] %s\n", domain) // Tạm tắt log để tránh rối màn hình
				}
			}
		}

		// --- 3. TCP SYN/ACK MONITORING ---
		if tcpLayer := packet.Layer(layers.LayerTypeTCP); tcpLayer != nil {
			tcp := tcpLayer.(*layers.TCP)
			if tcp.SYN && !tcp.ACK {
				synCount++
			} else if tcp.ACK && !tcp.SYN {
				ackCount++
			}
		}

		// Mở khóa Mutex
		dataMutex.Unlock()
	}
}

// ---------------- CÁC HÀM GỬI DỮ LIỆU (HTTP POST) ----------------

// Hàm gửi thông tin thiết bị (ARP Discovery)
func sendDiscoveryToServer(ip string, mac string) {
	payload := map[string]string{
		"ip":      ip,
		"mac":     mac,
		"agentId": AgentID,
	}
	jsonData, _ := json.Marshal(payload)

	// Post lên API của Node.js
	http.Post(ServerURL+"/api/discovery", "application/json", bytes.NewBuffer(jsonData))
}

// Hàm chạy ngầm: Cứ 5 giây gom dữ liệu Metrics gửi đi 1 lần
func startMetricsSender() {
	ticker := time.NewTicker(5 * time.Second)
	for range ticker.C {
		dataMutex.Lock()
		// Nếu không có hoạt động gì mạng thì không gửi
		if synCount == 0 && ackCount == 0 && len(dnsQueries) == 0 {
			dataMutex.Unlock()
			continue
		}

		// Copy dữ liệu hiện tại để chuẩn bị gửi
		currentSyn := synCount
		currentAck := ackCount
		currentDNS := dnsQueries

		// Reset lại bộ đếm về 0 cho chu kỳ 5 giây tiếp theo
		synCount = 0
		ackCount = 0
		dnsQueries = []string{}
		dataMutex.Unlock() // Mở khóa ngay lập tức để Agent bắt gói tin tiếp

		// Gói dữ liệu thành JSON
		payload := map[string]interface{}{
			"agentId": AgentID,
			"metrics": map[string]interface{}{
				"synCount":   currentSyn,
				"ackCount":   currentAck,
				"dnsQueries": currentDNS,
			},
		}
		jsonData, _ := json.Marshal(payload)

		// Gửi đi
		resp, err := http.Post(ServerURL+"/api/metrics", "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			fmt.Printf("[Lỗi] Không thể kết nối tới Server: %v\n", err)
		} else {
			fmt.Printf("[Metrics] Đã gửi lên Server -> SYN: %d | ACK: %d | DNS queries: %d\n", currentSyn, currentAck, len(currentDNS))
			resp.Body.Close()
		}
	}
}
