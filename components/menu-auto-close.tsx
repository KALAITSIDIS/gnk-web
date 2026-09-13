"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Closes the phone menu the way a person expects a menu to close.
 *
 * The menu is a native <details>, chosen so it works before hydration and
 * without JavaScript at all. Native <details> does not close on Escape, on a
 * tap outside itself, or when a link inside it navigates — and the header
 * lives in the root layout, so on a client-side navigation it stays exactly
 * as it was, open, over the top of the new page. This adds those three
 * closings when JavaScript is present. Without it the menu still opens and
 * closes on its own control, which is the whole of what it did before.
 *
 * It renders nothing and touches nothing else: the details element is found
 * by its place in the header at the moment of the event, not held in state.
 */
const menu = () => document.querySelector<HTMLDetailsElement>("header details");

export function MenuAutoClose() {
  const pathname = usePathname();

  // On navigation: the page changed under the open menu.
  useEffect(() => {
    const d = menu();
    if (d?.open) d.open = false;
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const d = menu();
      if (!d?.open) return;
      d.open = false;
      d.querySelector<HTMLElement>("summary")?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const d = menu();
      if (!d?.open) return;
      if (e.target instanceof Node && d.contains(e.target)) return;
      d.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return null;
}
