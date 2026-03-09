import { useState, useCallback, useRef } from "react";
import { myBackend } from "@/integrations/backend/client";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface LatencyMetrics {
  stt_ms: number;
  agent_ms: number;
  tts_ms: number;
  total_ms: number;
}

export function useVoiceAgent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [latency, setLatency] = useState<LatencyMetrics | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState("en");
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = detectedLanguage === "hi" ? "hi-IN" : detectedLanguage === "ta" ? "ta-IN" : detectedLanguage === "te" ? "te-IN" : "en-US";

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setCurrentTranscript(transcript);

      // Detect language from transcript
      if (/[\u0900-\u097F]/.test(transcript)) setDetectedLanguage("hi");
      else if (/[\u0B80-\u0BFF]/.test(transcript)) setDetectedLanguage("ta");
      else if (/[\u0C00-\u0C7F]/.test(transcript)) setDetectedLanguage("te");
      else setDetectedLanguage("en");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [detectedLanguage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string, lang: string) => {
    return new Promise<number>((resolve) => {
      const startTime = performance.now();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : lang === "te" ? "te-IN" : "en-US";
      utterance.rate = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve(Math.round(performance.now() - startTime));
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve(Math.round(performance.now() - startTime));
      };
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const sttEnd = performance.now();
      const userMessage: Message = { role: "user", content: text, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMessage]);
      setCurrentTranscript("");
      setIsProcessing(true);

      try {
        const agentStart = performance.now();
        const { data, error } = await myBackend.functions.invoke("voice-agent", {
          body: {
            messages: [{ role: "user", content: text }],
            session_id: sessionIdRef.current,
          },
        });

        if (error) throw error;
        const agentMs = data.latency_ms || Math.round(performance.now() - agentStart);

        const assistantMessage: Message = {
          role: "assistant",
          content: data.content,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsProcessing(false);

        // Speak the response
        const ttsMs = await speak(data.content, detectedLanguage);

        const metrics: LatencyMetrics = {
          stt_ms: 0, // Browser STT doesn't give us this easily
          agent_ms: agentMs,
          tts_ms: ttsMs,
          total_ms: agentMs + ttsMs,
        };
        setLatency(metrics);

        // Log latency
        await myBackend.from("latency_logs").insert([
          { session_id: sessionIdRef.current, stage: "tts", duration_ms: ttsMs },
          { session_id: sessionIdRef.current, stage: "total", duration_ms: metrics.total_ms },
        ]);
      } catch (e) {
        console.error("Agent error:", e);
        setIsProcessing(false);
        const errorMsg: Message = {
          role: "assistant",
          content: "I'm having trouble processing that request. Could you please repeat?",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [detectedLanguage, speak]
  );

  return {
    messages,
    isListening,
    isSpeaking,
    isProcessing,
    currentTranscript,
    latency,
    detectedLanguage,
    sessionId: sessionIdRef.current,
    startListening,
    stopListening,
    stopSpeaking,
    sendMessage,
    setMessages,
  };
}
