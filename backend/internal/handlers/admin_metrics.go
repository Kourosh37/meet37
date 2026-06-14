package handlers

import (
	"bufio"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"meet-backend/internal/signaling"
)

type adminAnalyticsPoint struct {
	Label string `json:"label"`
	Start int64  `json:"start"`
	End   int64  `json:"end"`
	Count int    `json:"count"`
}

type adminAnalyticsSeries struct {
	Total  int                   `json:"total"`
	Series []adminAnalyticsPoint `json:"series"`
}

type adminAnalyticsResponse struct {
	Range string               `json:"range"`
	Users adminAnalyticsSeries `json:"users"`
	Rooms adminAnalyticsSeries `json:"rooms"`
}

type serverCPUStatus struct {
	Percent float64 `json:"percent"`
	Cores   int     `json:"cores"`
}

type serverMemoryStatus struct {
	TotalBytes uint64  `json:"total_bytes"`
	UsedBytes  uint64  `json:"used_bytes"`
	FreeBytes  uint64  `json:"free_bytes"`
	Percent    float64 `json:"percent"`
}

type serverDiskStatus struct {
	Path       string  `json:"path"`
	TotalBytes uint64  `json:"total_bytes"`
	UsedBytes  uint64  `json:"used_bytes"`
	FreeBytes  uint64  `json:"free_bytes"`
	Percent    float64 `json:"percent"`
}

type serverRuntimeStatus struct {
	HeapAllocBytes uint64 `json:"heap_alloc_bytes"`
	Goroutines     int    `json:"goroutines"`
}

type adminServerStatusResponse struct {
	CollectedAt int64               `json:"collected_at"`
	CPU         serverCPUStatus     `json:"cpu"`
	Memory      serverMemoryStatus  `json:"memory"`
	Disk        serverDiskStatus    `json:"disk"`
	Runtime     serverRuntimeStatus `json:"runtime"`
}

type roomResourceEstimate struct {
	EstimatedCPUPercent  float64 `json:"estimated_cpu_percent"`
	EstimatedMemoryBytes uint64  `json:"estimated_memory_bytes"`
	ShareOfActivePeers   float64 `json:"share_of_active_peers"`
	TotalActivePeerCount int     `json:"total_active_peer_count"`
	RoomActivePeerCount  int     `json:"room_active_peer_count"`
	EstimateBasis        string  `json:"estimate_basis"`
}

type adminRoomDetailResponse struct {
	signaling.LiveRoomDetail
	Resources roomResourceEstimate `json:"resources"`
}

func (h *AdminHandler) GetAnalytics(w http.ResponseWriter, r *http.Request) {
	rangeKey := normalizeAnalyticsRange(r.URL.Query().Get("range"))
	buckets := analyticsBuckets(rangeKey, time.Now())
	users, err := h.analyticsForTable("users", buckets)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	rooms, err := h.analyticsForTable("rooms", buckets)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, adminAnalyticsResponse{
		Range: rangeKey,
		Users: users,
		Rooms: rooms,
	})
}

func (h *AdminHandler) GetServerStatus(w http.ResponseWriter, r *http.Request) {
	status := collectServerStatus()
	writeJSON(w, http.StatusOK, status)
}

func (h *AdminHandler) roomDetailWithResources(roomID string) adminRoomDetailResponse {
	detail := h.hub.GetRoomDetail(roomID)
	status := collectServerStatus()
	totalPeers := h.hub.TotalActivePeers()
	roomPeers := detail.PeerCount
	share := 0.0
	if totalPeers > 0 && roomPeers > 0 {
		share = float64(roomPeers) / float64(totalPeers)
	}
	return adminRoomDetailResponse{
		LiveRoomDetail: detail,
		Resources: roomResourceEstimate{
			EstimatedCPUPercent:  roundPercent(status.CPU.Percent * share),
			EstimatedMemoryBytes: uint64(float64(status.Memory.UsedBytes) * share),
			ShareOfActivePeers:   roundPercent(share * 100),
			TotalActivePeerCount: totalPeers,
			RoomActivePeerCount:  roomPeers,
			EstimateBasis:        "active_peer_share",
		},
	}
}

type analyticsBucket struct {
	label string
	start time.Time
	end   time.Time
}

func normalizeAnalyticsRange(value string) string {
	switch value {
	case "today", "7d", "30d":
		return value
	default:
		return "7d"
	}
}

func analyticsBuckets(rangeKey string, now time.Time) []analyticsBucket {
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	switch rangeKey {
	case "today":
		buckets := make([]analyticsBucket, 0, 24)
		for i := 0; i < 24; i++ {
			start := dayStart.Add(time.Duration(i) * time.Hour)
			buckets = append(buckets, analyticsBucket{
				label: start.Format("15:00"),
				start: start,
				end:   start.Add(time.Hour),
			})
		}
		return buckets
	case "30d":
		return dailyBuckets(dayStart.AddDate(0, 0, -29), 30)
	default:
		return dailyBuckets(dayStart.AddDate(0, 0, -6), 7)
	}
}

func dailyBuckets(start time.Time, days int) []analyticsBucket {
	buckets := make([]analyticsBucket, 0, days)
	for i := 0; i < days; i++ {
		bucketStart := start.AddDate(0, 0, i)
		buckets = append(buckets, analyticsBucket{
			label: bucketStart.Format("Jan 02"),
			start: bucketStart,
			end:   bucketStart.AddDate(0, 0, 1),
		})
	}
	return buckets
}

func (h *AdminHandler) analyticsForTable(table string, buckets []analyticsBucket) (adminAnalyticsSeries, error) {
	if table != "users" && table != "rooms" {
		return adminAnalyticsSeries{}, nil
	}
	var total int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&total); err != nil {
		return adminAnalyticsSeries{}, err
	}
	points := make([]adminAnalyticsPoint, 0, len(buckets))
	for _, bucket := range buckets {
		var count int
		if err := h.db.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE created_at >= ? AND created_at < ?`, bucket.start.Unix(), bucket.end.Unix()).Scan(&count); err != nil {
			return adminAnalyticsSeries{}, err
		}
		points = append(points, adminAnalyticsPoint{
			Label: bucket.label,
			Start: bucket.start.Unix(),
			End:   bucket.end.Unix(),
			Count: count,
		})
	}
	return adminAnalyticsSeries{Total: total, Series: points}, nil
}

func collectServerStatus() adminServerStatusResponse {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	return adminServerStatusResponse{
		CollectedAt: time.Now().Unix(),
		CPU: serverCPUStatus{
			Percent: sampleCPUPercent(),
			Cores:   runtime.NumCPU(),
		},
		Memory:  readMemoryStatus(),
		Disk:    readDiskStatus("/"),
		Runtime: serverRuntimeStatus{HeapAllocBytes: memStats.HeapAlloc, Goroutines: runtime.NumGoroutine()},
	}
}

type cpuSnapshot struct {
	idle  uint64
	total uint64
}

func sampleCPUPercent() float64 {
	first, ok := readCPUSnapshot()
	if !ok {
		return 0
	}
	time.Sleep(120 * time.Millisecond)
	second, ok := readCPUSnapshot()
	if !ok || second.total <= first.total {
		return 0
	}
	totalDelta := second.total - first.total
	idleDelta := second.idle - first.idle
	if totalDelta == 0 || idleDelta > totalDelta {
		return 0
	}
	return roundPercent(float64(totalDelta-idleDelta) * 100 / float64(totalDelta))
}

func readCPUSnapshot() (cpuSnapshot, bool) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return cpuSnapshot{}, false
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return cpuSnapshot{}, false
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuSnapshot{}, false
	}
	var total uint64
	values := make([]uint64, 0, len(fields)-1)
	for _, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			value = 0
		}
		values = append(values, value)
		total += value
	}
	idle := values[3]
	if len(values) > 4 {
		idle += values[4]
	}
	return cpuSnapshot{idle: idle, total: total}, true
}

func readMemoryStatus() serverMemoryStatus {
	values := map[string]uint64{}
	file, err := os.Open("/proc/meminfo")
	if err == nil {
		defer file.Close()
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			fields := strings.Fields(scanner.Text())
			if len(fields) < 2 {
				continue
			}
			key := strings.TrimSuffix(fields[0], ":")
			value, err := strconv.ParseUint(fields[1], 10, 64)
			if err == nil {
				values[key] = value * 1024
			}
		}
	}
	total := values["MemTotal"]
	free := values["MemAvailable"]
	if total == 0 {
		var memStats runtime.MemStats
		runtime.ReadMemStats(&memStats)
		total = memStats.Sys
		free = 0
	}
	used := uint64(0)
	if total > free {
		used = total - free
	}
	return serverMemoryStatus{
		TotalBytes: total,
		UsedBytes:  used,
		FreeBytes:  free,
		Percent:    percent(used, total),
	}
}

func percent(value, total uint64) float64 {
	if total == 0 {
		return 0
	}
	return roundPercent(float64(value) * 100 / float64(total))
}

func roundPercent(value float64) float64 {
	return float64(int(value*10+0.5)) / 10
}
