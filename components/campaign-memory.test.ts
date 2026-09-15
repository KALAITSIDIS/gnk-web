import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampaignMemory } from "./campaign-memory";

/**
 * The campaign memory (gnk-crm 0098, audit LR-02): a visit that LANDS with
 * utm_ parameters keeps them for the session, so an enquiry sent three pages
 * later can still say where the visitor came from. It draws nothing and does
 * its one thing in the browser only; the layout mounts it once so every
 * landing page is covered without each page knowing.
 */
describe("CampaignMemory", () => {
  it("renders nothing — it only remembers, and only in the browser", () => {
    expect(renderToStaticMarkup(createElement(CampaignMemory))).toBe("");
  });

  it("is mounted once, in the root layout", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf-8");
    expect(layout.match(/<CampaignMemory\s*\/>/g)).toHaveLength(1);
  });
});
