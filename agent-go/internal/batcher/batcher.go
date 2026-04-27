package batcher

import (
	"sync"
	"time"

	"netsentinel/agent/internal/config"
	"netsentinel/agent/internal/models"
	"netsentinel/agent/internal/sender"
)

type DomainBatcher struct {
	stats      map[string]*models.DomainStat
	mutex      sync.Mutex
	domainChan <-chan models.DomainEvent
}

func NewDomainBatcher(ch <-chan models.DomainEvent) *DomainBatcher {
	return &DomainBatcher{
		stats:      make(map[string]*models.DomainStat),
		domainChan: ch,
	}
}

func (b *DomainBatcher) Start() {
	ticker := time.NewTicker(config.BatchWindowSeconds * time.Second)

	go func() {
		for event := range b.domainChan {
			b.mutex.Lock()
			key := event.Domain + "_" + string(event.Source)
			if stat, exists := b.stats[key]; exists {
				stat.HitCount++
				stat.TotalBytes += event.Bytes
			} else {
				b.stats[key] = &models.DomainStat{
					Domain: event.Domain, Source: string(event.Source),
					HitCount: 1, TotalBytes: event.Bytes,
				}
			}
			b.mutex.Unlock()
		}
	}()

	go func() {
		for range ticker.C {
			b.flushAndSend()
		}
	}()
}

func (b *DomainBatcher) flushAndSend() {
	b.mutex.Lock()
	if len(b.stats) == 0 {
		b.mutex.Unlock()
		return
	}

	var trafficData []models.DomainStat
	for _, stat := range b.stats {
		trafficData = append(trafficData, *stat)
	}
	b.stats = make(map[string]*models.DomainStat)
	b.mutex.Unlock()

	payload := models.TrafficBatch{
		AgentID:     config.AgentID,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		TrafficData: trafficData,
	}
	sender.SendTrafficBatch(payload)
}
