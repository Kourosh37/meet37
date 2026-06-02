"use client";

import { useEffect, useRef, useState } from "react";
import type { ConnectionQuality } from "@/features/meeting/types/peer";
import type { StatsPayload } from "@/features/meeting/types/signaling";
import { WebRTCStatsCollector } from "@/lib/webrtc/statsCollector";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

const STATS_INTERVAL_MS = 5_000;

function qualityFromStats(stats: StatsPayload): ConnectionQuality {
  if (stats.packet_loss_pct >= 6 || stats.rtt_ms >= 350) {
    return "poor";
  }

  if (stats.packet_loss_pct >= 2 || stats.rtt_ms >= 180) {
    return "warning";
  }

  return "good";
}

export function useQualityStats(connections: Map<string, RTCPeerConnection>) {
  const collector = useRef(new WebRTCStatsCollector());
  const [quality, setQuality] = useState<ConnectionQuality>("unknown");

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (connections.size === 0) {
        setQuality("unknown");
        return;
      }

      void collector.current
        .collect(connections.values())
        .then((stats) => {
          if (stats) {
            setQuality(qualityFromStats(stats));
            webSocketManager.send({ payload: stats, type: "stats" });
          }
        })
        .catch(() => undefined);
    }, STATS_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [connections]);

  return quality;
}
