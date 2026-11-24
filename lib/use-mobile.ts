"use client";
import { useEffect, useState } from "react";

/** Vrai sur téléphone (≤ 760 px). Mis à jour à la rotation / au redimensionnement. */
export function useIsMobile(max = 760) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max}px)`);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [max]);
  return mobile;
}
