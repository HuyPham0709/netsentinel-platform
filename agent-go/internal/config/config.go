package config

const (
	AgentID   = "win-agent-01"
	ServerURL = "http://localhost:3000"

	MinTrafficThreshold   = 512 * 1024 
	SensitivityMultiplier = 5          
	MinSynFloodThreshold  = 150        
	SynAckRatioThreshold  = 5          

	BatchWindowSeconds = 10            
)