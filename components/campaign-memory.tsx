"use client";

import { useEffect } from "react";
import { rememberCampaign } from "@/lib/enquiry-fields";

/**
 * Remembers the campaign a visit LANDED with (gnk-crm 0098, audit LR-02).
 *
 * An ad link carries `utm_` parameters on the first page only; the enquiry
 * form is usually three pages later. So the root layout mounts this once, it
 * reads the landing URL after hydration, and keeps the three campaign keys in
 * the browser's session storage until the tab closes — where the enquiry
 * form reads them back (lib/enquiry-fields.ts). It draws nothing.
 *
 * Session storage, not a cookie and not local storage: nothing is sent with
 * requests, nothing survives the tab, nothing else reads it. /legal says so,
 * and app/legal/page.test.ts binds that sentence to this file.
 */
export function CampaignMemory() {
  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null; // a private window that refuses storage is not a bug
    }
    rememberCampaign(window.location.search, storage);
  }, []);
  return null;
}
