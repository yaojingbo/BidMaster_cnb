import { useRef, useEffect } from "react";

export function useDebouncedSync<T>(
  value: T,
  syncFn: (val: T) => void,
  delay: number = 200,
  shouldSync: boolean = true,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!shouldSync) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => syncFn(value), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  });
}
