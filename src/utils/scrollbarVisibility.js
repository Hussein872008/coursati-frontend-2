// Helper: toggles `body` class `show-scrollbar` while user is actively scrolling
// This makes scrollbars appear only during user scroll activity (mobile-friendly)

let timer = null;
export default function initScrollbarVisibility({ timeout = 700 } = {}) {
  if (typeof window === 'undefined' || !document || !document.body) return;
  const onScroll = () => {
    try {
      document.body.classList.add('show-scrollbar');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.remove('show-scrollbar'), timeout);
    } catch (e) {}
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  // also show on pointer scroll (wheel, touchmove)
  window.addEventListener('wheel', onScroll, { passive: true });
  window.addEventListener('touchmove', onScroll, { passive: true });
  // expose a way to stop
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onScroll);
    window.removeEventListener('touchmove', onScroll);
    if (timer) clearTimeout(timer);
  };
}
