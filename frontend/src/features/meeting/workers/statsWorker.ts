import { WebRTCStatsCollector } from "@/lib/webrtc/statsCollector";

export type StatsWorkerRequest = {
  connections: RTCPeerConnection[];
  type: "collect";
};

export type StatsWorkerResponse = Awaited<
  ReturnType<WebRTCStatsCollector["collect"]>
>;

const collector = new WebRTCStatsCollector();

export async function collectStats(connections: Iterable<RTCPeerConnection>) {
  return collector.collect(connections);
}
