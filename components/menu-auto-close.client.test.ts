// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The phone menu closes the ways a person expects — including when keyboard
 * focus leaves it. The panel overlays the page, so focus tabbing out of it
 * landed on controls hidden UNDER it (WCAG 2.4.11; review 2026-10-18), and
 * since the menu now serves 768–1023 px windows too, a keyboard is likelier.
 */
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { MenuAutoClose } = await import("./menu-auto-close");

let root: Root;
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

function mount() {
  document.body.innerHTML =
    '<header><details><summary>Menu</summary><a href="/a">A</a></details></header><main><a id="out" href="/b">B</a></main><div id="r"></div>';
  root = createRoot(document.getElementById("r")!);
  act(() => root.render(createElement(MenuAutoClose)));
  // Opened after mounting: on mount the component closes a menu left open
  // across a navigation, which is its first job.
  const d = document.querySelector("details")!;
  d.open = true;
  return d;
}

describe("the phone menu", () => {
  it("stays open while focus moves inside it", () => {
    const d = mount();
    act(() => document.querySelector<HTMLAnchorElement>("details a")!.focus());
    expect(d.open).toBe(true);
  });

  it("closes when focus moves outside it", () => {
    const d = mount();
    act(() => document.querySelector<HTMLAnchorElement>("details a")!.focus());
    act(() => document.getElementById("out")!.focus());
    expect(d.open).toBe(false);
  });

  it("still closes on Escape and returns focus to its control", () => {
    const d = mount();
    act(() => document.querySelector<HTMLAnchorElement>("details a")!.focus());
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(d.open).toBe(false);
    expect(document.activeElement?.tagName).toBe("SUMMARY");
  });
});
