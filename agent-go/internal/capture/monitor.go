package capture

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"

	"netsentinel/agent/internal/config"
	"netsentinel/agent/internal/sender"
)

var (
	totalSynCount int
	totalAckCount int
	totalBytes    int

	synPerIP = make(map[string]int)
	ackPerIP = make(map[string]int)

	historyBps []int
	dataMutex  sync.Mutex
)

// HÀM CŨ: Xử lý gói tin
func ProcessPacket(packet gopacket.Packet) {
	if arpLayer := packet.Layer(layers.LayerTypeARP); arpLayer != nil {
		arp := arpLayer.(*layers.ARP)
		if arp.Operation == layers.ARPRequest || arp.Operation == layers.ARPReply {
			go sender.SendDiscovery(net.IP(arp.SourceProtAddress).String(), net.HardwareAddr(arp.SourceHwAddress).String())
		}
	}

	dataMutex.Lock()
	defer dataMutex.Unlock()

	totalBytes += len(packet.Data())

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

// HÀM CŨ: Chạy vòng lặp kiểm tra thuật toán
func StartMetricsSender() {
	ticker := time.NewTicker(1 * time.Second)
	for range ticker.C {
		dataMutex.Lock()
		currentBps := totalBytes / 1
		alerts := []map[string]string{}

		historyBps = append(historyBps, currentBps)
		if len(historyBps) > 10 {
			historyBps = historyBps[1:]
		}

		avgBps := getAverage(historyBps)
		if len(historyBps) >= 5 && currentBps > config.MinTrafficThreshold {
			if currentBps > (avgBps * config.SensitivityMultiplier) {
				alerts = append(alerts, map[string]string{
					"title":       "Băng thông tăng vọt",
					"sourceIp":    config.AgentID,
					"targetIp":    "Hệ thống",
					"description": fmt.Sprintf("Lưu lượng %s vượt mức trung bình %s", sender.FormatBytes(currentBps), sender.FormatBytes(avgBps)),
					"type":        "warning",
				})
			}
		}

		for ip, synCount := range synPerIP {
			ackCount := ackPerIP[ip]
			if synCount > config.MinSynFloodThreshold && synCount > (ackCount*config.SynAckRatioThreshold) {
				alerts = append(alerts, map[string]string{
					"title":       "Nghi vấn SYN Flood",
					"sourceIp":    ip,
					"targetIp":    "Máy chủ",
					"description": fmt.Sprintf("Phát hiện %d gói SYN không có hồi đáp từ IP này", synCount),
					"type":        "critical",
				})
			}
		}

		cSyn, cAck, cBps := totalSynCount, totalAckCount, currentBps
		totalSynCount, totalAckCount, totalBytes = 0, 0, 0
		synPerIP = make(map[string]int)
		ackPerIP = make(map[string]int)
		dataMutex.Unlock()

		sender.SendMetrics(cSyn, cAck, cBps, alerts)
	}
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
