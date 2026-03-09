import { Message } from "@/hooks/useVoiceAgent";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  // check if the message is from the user!!
  const isUser = message.role === "user";

  // console.log("rendered message inside ChatMessage component:", message); // TODO: remove before push!!

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
          }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${isUser
            ? "bg-primary/15 text-foreground"
            : "bg-card text-card-foreground border border-border"
          }`}
      >
        <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
}
