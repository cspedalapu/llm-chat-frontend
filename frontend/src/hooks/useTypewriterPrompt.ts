import { useEffect, useState } from "react";

/**
 * Types a phrase out, holds it, deletes it, then moves to the next one.
 * Restored from the original landing page; pairs with the .empty-prompt-caret
 * blink so the hero line reads as if it is being typed live.
 */
export function useTypewriterPrompt(phrases: string[]): string {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visibleLength, setVisibleLength] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!phrases.length) return;
    const phrase = phrases[phraseIndex] ?? "";
    const complete = visibleLength === phrase.length;
    const cleared = visibleLength === 0;
    const delay = isDeleting ? (cleared ? 240 : 55) : complete ? 1100 : 95;

    const timer = window.setTimeout(() => {
      if (!isDeleting && !complete) return setVisibleLength(n => n + 1);
      if (!isDeleting) return setIsDeleting(true);
      if (!cleared) return setVisibleLength(n => n - 1);
      setIsDeleting(false);
      setPhraseIndex(n => (n + 1) % phrases.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [isDeleting, phraseIndex, phrases, visibleLength]);

  return (phrases[phraseIndex] ?? "").slice(0, visibleLength);
}
