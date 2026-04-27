package models

type TrafficSource string

const (
	SourceDNS TrafficSource = "DNS"
	SourceSNI TrafficSource = "SNI"
)

type DomainEvent struct {
	Domain string
	Source TrafficSource
	Bytes  int
}

type DomainStat struct {
	Domain     string `json:"domain"`
	Source     string `json:"source"`
	HitCount   int    `json:"hitCount"`
	TotalBytes int    `json:"totalBytes"`
}

type TrafficBatch struct {
	AgentID     string       `json:"agentId"`
	Timestamp   string       `json:"timestamp"`
	TrafficData []DomainStat `json:"trafficData"`
}
