import { useEffect } from "react";

export default function useTitle(title) {
  useEffect(() => {
    const prev = typeof document !== "undefined" ? document.title : "";
    if (title && typeof document !== "undefined") document.title = title;
    return () => {
      if (typeof document !== "undefined") document.title = prev;
    };
  }, [title]);
}
