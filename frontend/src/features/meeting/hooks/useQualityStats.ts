"use client";

import { useEffect, useRef } from "react";
import { WebRTCStatsCollector } from "@/lib/webrtc/statsCollector";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

const STATS_INTERVAL_MS = 5_000;

export function useQualityStats(connections: Map<string, RTCPeerConnection>) {
  const collector = useRef(new WebRTCStatsCollector());

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (connections.size === 0) {
        return;
      }

      void collector.current
        .collect(connections.values())
        .then((stats) => {
          if (stats) {
            webSocketManager.send({ payload: stats, type: "stats" });
          }
        })
        .catch(() => undefined);
    }, STATS_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [connections]);
}
