import type { Metadata } from "next";
import Link from "next/link";

/**
 * The generic 404 names itself. It carried the site's default title, so the
 * tab, the history entry and a bookmark of a dead link all read as the home
 * page (second pass, 2026-09-13). The docs promise a metadata export only
 * for a global-not-found, but this Next honours one here too — measured on
 * the production build: the head carries "Page not found — GN Kalaitsidis
 * Capital" through the layout's template, and the tab shows it. Two other
 * routes were tried first and did not work: a <title> rendered in the page
 * loses to the layout's, and document.title set after hydration is
 * overwritten when the streamed metadata lands. app/not-found.test.ts.
 */
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl">That page is not here.</h1>
      <p className="mt-4 text-ink-2">
        The property may have been sold or withdrawn. Our current mandates are always on the
        properties page.
      </p>
      <Link
        href="/properties"
        className="mt-7 inline-block bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-hover"
      >
        See current properties
      </Link>
    </div>
  );
}
