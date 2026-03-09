import { motion } from "framer-motion";

interface VoiceVisualizerProps {
  isActive: boolean;
  variant: "listening" | "speaking" | "idle";
}

export function VoiceVisualizer({ isActive, variant }: VoiceVisualizerProps) {
  const barCount = 24;
  const colors = {
    listening: "bg-primary",
    speaking: "bg-accent",
    idle: "bg-muted-foreground/30",
  };

  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-1 rounded-full ${colors[variant]}`}
          animate={
            isActive
              ? {
                  height: [4, Math.random() * 48 + 16, 4],
                  opacity: [0.4, 1, 0.4],
                }
              : { height: 4, opacity: 0.2 }
          }
          transition={
            isActive
              ? {
                  duration: 0.5 + Math.random() * 0.5,
                  repeat: Infinity,
                  delay: i * 0.04,
                  ease: "easeInOut",
                }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}
