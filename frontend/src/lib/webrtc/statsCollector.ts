import type { StatsPayload } from "@/features/meeting/types/signaling";

interface PreviousByteSample {
  bytes: number;
  timestamp: number;
}

export class WebRTCStatsCollector {
  private readonly previousOutboundBytes = new Map<
    string,
    PreviousByteSample
  >();

  async collect(connections: Iterable<RTCPeerConnection>) {
    let bitrateKbps = 0;
    let packetsLost = 0;
    let packetsTotal = 0;
    let rttTotalMs = 0;
    let rttSamples = 0;

    for (const connection of connections) {
      const report = await connection.getStats();

      report.forEach((stat) => {
        const sample = stat as RTCStats & {
          bytesSent?: number;
          currentRoundTripTime?: number;
          packetsLost?: number;
          packetsReceived?: number;
          packetsSent?: number;
          state?: string;
        };

        if (
          sample.type === "outbound-rtp" &&
          typeof sample.bytesSent === "number"
        ) {
          const previous = this.previousOutboundBytes.get(sample.id);

          if (previous && sample.timestamp > previous.timestamp) {
            const deltaBytes = Math.max(0, sample.bytesSent - previous.bytes);
            const deltaSeconds = (sample.timestamp - previous.timestamp) / 1000;
            bitrateKbps +=
              deltaSeconds > 0 ? (deltaBytes * 8) / deltaSeconds / 1000 : 0;
          }

          this.previousOutboundBytes.set(sample.id, {
            bytes: sample.bytesSent,
            timestamp: sample.timestamp
          });
        }

        if (
          (sample.type === "inbound-rtp" || sample.type === "outbound-rtp") &&
          typeof sample.packetsLost === "number"
        ) {
          const delivered =
            typeof sample.packetsReceived === "number"
              ? sample.packetsReceived
              : (sample.packetsSent ?? 0);
          packetsLost += Math.max(0, sample.packetsLost);
          packetsTotal += Math.max(0, delivered + sample.packetsLost);
        }

        if (
          sample.type === "candidate-pair" &&
          sample.state === "succeeded" &&
          typeof sample.currentRoundTripTime === "number"
        ) {
          rttTotalMs += sample.currentRoundTripTime * 1000;
          rttSamples += 1;
        }
      });
    }

    if (bitrateKbps === 0 && packetsTotal === 0 && rttSamples === 0) {
      return null;
    }

    return {
      bitrate_kbps: Math.round(bitrateKbps),
      packet_loss_pct:
        packetsTotal > 0 ? (packetsLost / packetsTotal) * 100 : 0,
      rtt_ms: rttSamples > 0 ? Math.round(rttTotalMs / rttSamples) : 0
    } satisfies StatsPayload;
  }
}
