/**
 * The ONLY place on this site that writes structured data into a page.
 *
 * JSON.stringify does not escape `<`. Every application/ld+json block here was
 * JSON.stringify written raw into dangerouslySetInnerHTML — three copies of one
 * sink — and React adds no escaping inside <script>. A `</script>` in any CRM
 * text field (a title, a description, an area name — length is the only rule
 * the CRM applies to them, and the service-role import applies none) would have
 * ended the data block, and whatever followed would have parsed as HTML on a
 * page that collects buyer contact details. Nothing exploited it; the
 * precondition is an MFA'd editor or the service key. Closed anyway: the fix is
 * a dozen lines, and it closes the class rather than the instance.
 *
 * `<` becomes < — valid JSON, identical once parsed, inert inside a script
 * element. That is Next's documented mitigation. A CSP is not the answer on
 * this ISR site: a nonce forfeits the last-good-copy behaviour the listing page
 * depends on, and hashes cannot cover Next's own chunks.
 *
 * json-ld.test.ts pins both halves: the escaping, and that no other file under
 * app/ or components/ contains the MIME type or the sink.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
  );
}
