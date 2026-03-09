import { LatencyMetrics } from "@/hooks/useVoiceAgent";
import { Zap } from "lucide-react";

interface LatencyDisplayProps {
  metrics: LatencyMetrics | null;
}

export function LatencyDisplay({ metrics }: LatencyDisplayProps) {
  if (!metrics) return null;

  const isUnderTarget = metrics.total_ms < 450;

  return (
    <div className="flex items-center gap-4 text-xs font-body">
      <div className="flex items-center gap-1">
        <Zap className={`w-3 h-3 ${isUnderTarget ? "text-success" : "text-warning"}`} />
        <span className="text-muted-foreground">Total:</span>
        <span className={isUnderTarget ? "text-success" : "text-warning"}>
          {metrics.total_ms}ms
        </span>
      </div>
      <div className="text-muted-foreground">
        Agent: {metrics.agent_ms}ms
      </div>
      <div className="text-muted-foreground">
        TTS: {metrics.tts_ms}ms
      </div>
      {isUnderTarget && (
        <span className="text-success text-[10px] bg-success/10 px-2 py-0.5 rounded-full">
          &lt; 450ms ✓
        </span>
      )}
    </div>
  );
}
