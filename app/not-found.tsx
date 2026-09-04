import Link from "next/link";

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
