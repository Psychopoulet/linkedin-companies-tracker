import { debounce } from "./debounce";

type HistoryStateMethod = typeof history.pushState;

export function initPageScanner(apply: () => void, debounceMs = 300): void {
  const debouncedApply = debounce(apply, debounceMs);

  const startObserver = () => {
    const observer = new MutationObserver(debouncedApply);
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) {
    startObserver();
  } else {
    window.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }

  window.addEventListener("popstate", debouncedApply);
  hookHistoryNavigation(debouncedApply);
}

function hookHistoryNavigation(onNavigate: () => void): void {
  const wrap =
    (original: HistoryStateMethod) =>
    (...args: Parameters<HistoryStateMethod>) => {
      original.apply(history, args);
      onNavigate();
    };

  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
}
