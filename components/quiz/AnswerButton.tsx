// components/quiz/AnswerButton.tsx — Individual answer option button
"use client";

import { cn } from "@/lib/utils";

interface AnswerButtonProps {
  index: number;
  text: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (index: number) => void;
}

export function AnswerButton({
  index,
  text,
  selected,
  disabled,
  onSelect,
}: AnswerButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      disabled={disabled}
      className={cn(
        "w-full p-4 rounded-lg font-semibold text-lg transition-all",
        "min-h-[60px] border-2",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        selected
          ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/50 ring-offset-2 ring-offset-background scale-[1.02] shadow-lg"
          : "bg-muted text-foreground border-border hover:bg-accent hover:border-accent-foreground/20"
      )}
    >
      {text}
    </button>
  );
}
