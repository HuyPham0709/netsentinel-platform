package main

import (
	"fmt"
	"log"

	"github.com/google/gopacket"
	"github.com/google/gopacket/pcap"
	
	"netsentinel/agent/internal/analyzer"
	"netsentinel/agent/internal/batcher"
	"netsentinel/agent/internal/capture"
	"netsentinel/agent/internal/config"
	"netsentinel/agent/internal/models"
)

func main() {
	deviceName := "\\Device\\NPF_{C4A4D568-AFDD-490D-AA01-782922AFFCCB}"

	fmt.Printf("[*] Khởi động NetSentinel Agent (%s)...\n", config.AgentID)

	handle, err := pcap.OpenLive(deviceName, 1600, true, pcap.BlockForever)
	if err != nil {
		log.Fatalf("Lỗi mở card mạng: %v", err)
	}
	defer handle.Close()

	// Đảm bảo bắt đủ gói để vừa chạy logic cũ, vừa chạy logic mới
	bpfFilter := "arp or tcp or (udp port 53)"
	if err := handle.SetBPFFilter(bpfFilter); err != nil {
		log.Fatalf("Lỗi cài đặt BPF Filter: %v", err)
	}

	fmt.Println("[+] Hệ thống đang chạy ở chế độ Hardened (Chống báo giả)...")
	fmt.Println("[+] Tính năng bóc tách SNI/DNS (DPI) đã được kích hoạt...")
	fmt.Println("--------------------------------------------------")

	// 1. Khởi động luồng DPI (MỚI)
	domainChan := make(chan models.DomainEvent, 5000)
	domainBatcher := batcher.NewDomainBatcher(domainChan)
	domainBatcher.Start()

	// 2. Khởi động luồng tính toán & bắn Metrics (CŨ)
	go capture.StartMetricsSender()

	// 3. Lắng nghe gói tin
	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	for packet := range packetSource.Packets() {
		// Module Capture xử lý đếm gói tin (Logic Cũ)
		capture.ProcessPacket(packet)

		// Module Analyzer bóc tách tên miền (Logic Mới)
		analyzer.AnalyzePacket(packet, domainChan)
	}
}
