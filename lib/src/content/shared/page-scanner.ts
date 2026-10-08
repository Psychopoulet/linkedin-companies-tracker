// deps

  // locals
  import { debounce } from "./debounce";

// types & interfaces

type HistoryStateMethod = typeof history.pushState;

// module

export function initPageScanner (apply: () => void, debounceMs = 300): void {

  const debouncedApply = debounce(apply, debounceMs);

  function _startObserver (): void {
    const observer = new MutationObserver(debouncedApply);
    observer.observe(document.body, { "childList": true, "subtree": true });
  }

  // `document.body` peut être null avant la fin du parsing du document.
  if (null !== (document.body as HTMLElement | null)) {
    _startObserver();
  }
  else {
    window.addEventListener("DOMContentLoaded", _startObserver, { "once": true });
  }

  window.addEventListener("popstate", debouncedApply);
  hookHistoryNavigation(debouncedApply);

}

function wrapHistoryMethod (original: HistoryStateMethod, onNavigate: () => void): HistoryStateMethod {

  return (...args: Parameters<HistoryStateMethod>): void => {
    original.apply(history, args);
    onNavigate();
  };

}

function hookHistoryNavigation (onNavigate: () => void): void {

  const originalPushState: HistoryStateMethod = history.pushState.bind(history);
  const originalReplaceState: HistoryStateMethod = history.replaceState.bind(history);

  history.pushState = wrapHistoryMethod(originalPushState, onNavigate);
  history.replaceState = wrapHistoryMethod(originalReplaceState, onNavigate);

}
