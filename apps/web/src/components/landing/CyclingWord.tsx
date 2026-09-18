import { useEffect, useState } from "react";

export function CyclingWord({ words, intervalMs = 2200 }: { words: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  return (
    <span key={index} className="inline-block animate-[fadeSlide_0.4s_ease-out] text-gold-500">
      {words[index]}
    </span>
  );
}
