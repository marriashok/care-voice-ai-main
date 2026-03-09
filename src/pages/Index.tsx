import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Activity, Calendar, Phone } from "lucide-react";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { VoiceVisualizer } from "@/components/VoiceVisualizer";
import { MicButton } from "@/components/MicButton";
import { LatencyDisplay } from "@/components/LatencyDisplay";
import { ChatMessage } from "@/components/ChatMessage";
import { LanguageBadge } from "@/components/LanguageBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const {
    messages,
    isListening,
    isSpeaking,
    isProcessing,
    currentTranscript,
    latency,
    detectedLanguage,
    startListening,
    stopListening,
    stopSpeaking,
    sendMessage,
  } = useVoiceAgent();

  const [textInput, setTextInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendText = () => {
    if (textInput.trim()) {
      sendMessage(textInput.trim());
      setTextInput("");
    }
  };

  const handleMicStop = () => {
    stopListening();
    if (currentTranscript.trim()) {
      sendMessage(currentTranscript.trim());
    }
  };

  const statusText = isListening
    ? "Listening..."
    : isSpeaking
    ? "Speaking..."
    : isProcessing
    ? "Processing..."
    : "Tap to speak";

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold text-foreground">2Care.ai</h1>
            <p className="text-xs text-muted-foreground">Voice AI Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageBadge language={detectedLanguage} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/appointments")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Appointments
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/campaigns")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Phone className="w-4 h-4 mr-1" />
            Campaigns
          </Button>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center gap-4"
          >
            <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center glow-primary">
              <Activity className="w-12 h-12 text-primary-foreground" />
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              Clinical Appointment Assistant
            </h2>
            <p className="text-muted-foreground max-w-md text-sm">
              Speak or type to book, reschedule, or cancel appointments.
              I support English, Hindi, and Tamil.
            </p>
            <div className="flex gap-2 mt-2">
              {[
                "Book appointment with cardiologist",
                "मुझे डॉक्टर से मिलना है",
                "நாளை மருத்துவரை பார்க்க வேண்டும்",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => sendMessage(example)}
                  className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
        </AnimatePresence>

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground text-sm"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing your request...
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Voice interface */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm">
        {/* Current transcript */}
        <AnimatePresence>
          {currentTranscript && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 py-2 text-sm text-muted-foreground italic border-b border-border"
            >
              "{currentTranscript}"
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visualizer */}
        <div className="px-6 py-2">
          <VoiceVisualizer
            isActive={isListening || isSpeaking}
            variant={isListening ? "listening" : isSpeaking ? "speaking" : "idle"}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-3 px-6 pb-4">
          <div className="flex items-center gap-4">
            <MicButton
              isListening={isListening}
              isSpeaking={isSpeaking}
              isProcessing={isProcessing}
              onStart={startListening}
              onStop={handleMicStop}
              onStopSpeaking={stopSpeaking}
            />
          </div>

          <p className="text-xs text-muted-foreground">{statusText}</p>

          {/* Text input fallback */}
          <div className="flex w-full max-w-lg gap-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendText()}
              placeholder="Or type your message..."
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              disabled={isProcessing}
            />
            <Button
              onClick={handleSendText}
              disabled={!textInput.trim() || isProcessing}
              size="icon"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Latency */}
          <LatencyDisplay metrics={latency} />
        </div>
      </div>
    </div>
  );
};

export default Index;
