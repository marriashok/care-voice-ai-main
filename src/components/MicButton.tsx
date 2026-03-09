import { motion } from "framer-motion";
import { Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MicButtonProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onStop: () => void;
  onStopSpeaking: () => void;
}

export function MicButton({ isListening, isSpeaking, isProcessing, onStart, onStop, onStopSpeaking }: MicButtonProps) {
  if (isSpeaking) {
    return (
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button
          onClick={onStopSpeaking}
          size="icon"
          className="w-20 h-20 rounded-full bg-accent hover:bg-accent/80 text-accent-foreground glow-accent"
        >
          <Square className="w-8 h-8" />
        </Button>
      </motion.div>
    );
  }

  if (isListening) {
    return (
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Button
          onClick={onStop}
          size="icon"
          className="w-20 h-20 rounded-full gradient-primary text-primary-foreground animate-pulse-glow"
        >
          <MicOff className="w-8 h-8" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Button
        onClick={onStart}
        disabled={isProcessing}
        size="icon"
        className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground glow-primary disabled:opacity-50"
      >
        <Mic className="w-8 h-8" />
      </Button>
    </motion.div>
  );
}
