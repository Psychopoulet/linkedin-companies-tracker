// module

export function debounce<T extends (...args: never[]) => void> (
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {

    if (null !== timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delayMs);

  };

}
