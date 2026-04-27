package analyzer

import (
	"netsentinel/agent/internal/models"
	"strings"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
)

func AnalyzePacket(packet gopacket.Packet, domainChan chan<- models.DomainEvent) {
	packetSize := len(packet.Data())

	if dnsLayer := packet.Layer(layers.LayerTypeDNS); dnsLayer != nil {
		dns, ok := dnsLayer.(*layers.DNS)
		if ok && !dns.QR && len(dns.Questions) > 0 {
			domain := string(dns.Questions[0].Name)
			if isValidDomain(domain) {
				domainChan <- models.DomainEvent{Domain: domain, Source: models.SourceDNS, Bytes: packetSize}
			}
		}
		return
	}

	if tcpLayer := packet.Layer(layers.LayerTypeTCP); tcpLayer != nil {
		tcp, _ := tcpLayer.(*layers.TCP)
		if len(tcp.Payload) > 0 && (tcp.DstPort == 443 || tcp.SrcPort == 443) {
			domain := extractSNI(tcp.Payload)
			if domain != "" && isValidDomain(domain) {
				domainChan <- models.DomainEvent{Domain: domain, Source: models.SourceSNI, Bytes: packetSize}
			}
		}
	}
}

func isValidDomain(domain string) bool {
	if domain == "" || strings.Contains(domain, ".local") || strings.Contains(domain, "arpa") {
		return false
	}
	return true
}

func extractSNI(payload []byte) string {
	if len(payload) < 43 || payload[0] != 0x16 || payload[5] != 0x01 {
		return ""
	}
	for i := 43; i < len(payload)-4; i++ {
		if payload[i] == 0x00 && payload[i+1] == 0x00 {
			extLen := int(payload[i+2])<<8 | int(payload[i+3])
			if i+4+extLen <= len(payload) && extLen > 5 {
				nameLen := int(payload[i+7])<<8 | int(payload[i+8])
				nameStart, nameEnd := i+9, i+9+nameLen
				if nameEnd <= len(payload) {
					return string(payload[nameStart:nameEnd])
				}
			}
			break
		}
	}
	return ""
}
