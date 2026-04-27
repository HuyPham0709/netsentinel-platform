package sender

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"netsentinel/agent/internal/config"
	"netsentinel/agent/internal/models"
)

// Hàm FormatBytes cũ của bạn được mang qua đây để phục vụ cho Printf
func FormatBytes(b int) string {
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

// LOGIC CŨ: Gửi ARP Discovery
func SendDiscovery(ip string, mac string) {
	payload := map[string]string{"ip": ip, "mac": mac, "agentId": config.AgentID}
	jsonData, _ := json.Marshal(payload)
	http.Post(config.ServerURL+"/api/discovery", "application/json", bytes.NewBuffer(jsonData))
}

// LOGIC CŨ: Gửi Metrics & Cảnh báo (Giữ nguyên Printf cũ)
func SendMetrics(syn, ack, bps int, alerts []map[string]string) {
	payload := map[string]interface{}{
		"agentId": config.AgentID,
		"metrics": map[string]interface{}{"synCount": syn, "ackCount": ack, "bytesPerSec": bps},
		"alerts":  alerts,
	}
	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(config.ServerURL+"/api/metrics", "application/json", bytes.NewBuffer(jsonData))
	if err == nil {
		timestamp := time.Now().Format("15:04:05")
		if len(alerts) > 0 {
			fmt.Printf("[!] %s - PHÁT HIỆN NGUY HIỂM: Đã bắn cảnh báo Telegram!\n", timestamp)
		} else {
			fmt.Printf("[%s] Metrics -> Traffic: %s | SYN: %d | ACK: %d\n", timestamp, FormatBytes(bps), syn, ack)
		}
		resp.Body.Close()
	}
}

// LOGIC MỚI: Gửi Batch Tên miền (DPI)
func SendTrafficBatch(payload models.TrafficBatch) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return
	}
	resp, err := http.Post(config.ServerURL+"/api/v1/agents/traffic-batch", "application/json", bytes.NewBuffer(jsonData))
	if err == nil {
		fmt.Printf("[+] Đã gửi thành công Batch gồm %d domains lên Server\n", len(payload.TrafficData))
		resp.Body.Close()
	}
}
