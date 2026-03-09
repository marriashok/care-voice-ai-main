import { Globe } from "lucide-react";

interface LanguageBadgeProps {
  language: string;
}

const languageNames: Record<string, string> = {
  en: "English",
  hi: "हिंदी",
  ta: "தமிழ்",
};

export function LanguageBadge({ language }: LanguageBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 bg-secondary px-3 py-1 rounded-full text-xs text-secondary-foreground">
      <Globe className="w-3 h-3" />
      <span>{languageNames[language] || language}</span>
    </div>
  );
}
