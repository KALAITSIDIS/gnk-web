// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The enquiry key from the form's own point of view: minted once when the
 * form mounts, sent on every attempt from that form, and the SAME on every
 * attempt. The CRM's door treats a repeated post with the same key as the
 * same enquiry (gnk-crm 0096), and that is the whole of what makes a retry
 * safe — a visitor who presses Send again after a timeout, a 429 or a dropped
 * connection must be one lead, not two.
 *
 * WHAT WENT WRONG BEFORE (found 2026-09-20). The key lived in a hidden input,
 * written into the DOM by the mount effect, and the request read it back
 * through FormData. React re-syncs an uncontrolled input's `defaultValue=""`
 * on every commit (react-dom updateInput → setDefaultValue), and for a
 * type="hidden" input the value IS the attribute — HTML's "default" value
 * mode, no dirty value — so the first re-render after mount, the one that
 * turns the button into "Sending…", wiped the key. The first request carried
 * it; every request after that carried "", which the route forwards as no key
 * at all, and a retry after a lost answer was a second lead.
 *
 * components/enquiry-form.test.ts pins the SERVER markup. This file mounts
 * the form in a DOM, the way property-search.client.test.ts does, and presses
 * Send the way a person does.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { EnquiryForm } = await import("./enquiry-form");

/** The shape the CRM's door accepts (gnk-crm 0096); the route refuses any other before posting. */
const KEY_SHAPE = /^[A-Za-z0-9-]{8,64}$/;

type Props = Parameters<typeof EnquiryForm>[0];
const roots: Root[] = [];

function mount(props: Props = { reference: "PAF0001" }): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(createElement(EnquiryForm, props));
  });
  return container;
}

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function q<T extends Element>(from: ParentNode, selector: string): T {
  const el = from.querySelector<T>(selector);
  if (!el) throw new Error(`nothing matches ${selector}`);
  return el;
}
const keyInput = (c: ParentNode) => q<HTMLInputElement>(c, 'input[name="enquiry_key"]');
const sendButton = (c: ParentNode) => q<HTMLButtonElement>(c, 'button[type="submit"]');
const alertText = (c: ParentNode) => q<HTMLElement>(c, '[role="alert"]').textContent ?? "";

/** A name, an email and consent: the least the form needs before it will send. */
function fillIn(c: ParentNode, { email = "buyer@example.invalid" }: { email?: string } = {}) {
  q<HTMLInputElement>(c, 'input[name="name"]').value = "A Buyer";
  q<HTMLInputElement>(c, 'input[name="email"]').value = email;
  q<HTMLInputElement>(c, 'input[name="consent"]').checked = true;
}

/**
 * Press Send and let the handler run to its end. Every branch of onSubmit
 * awaits fetch and the reply's body before it sets state, so a few turns of
 * the event loop are given inside act, which then flushes the render.
 */
async function press(c: ParentNode) {
  await act(async () => {
    sendButton(c).click();
    for (let turn = 0; turn < 5; turn++) await new Promise((r) => setTimeout(r, 0));
  });
}

const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** The route's own two lost-answer shapes: a connection that fell over, and the browser's 20 s abort. */
const connectionLost = () => new TypeError("Failed to fetch");
const timedOut = () => new DOMException("The operation was aborted due to timeout", "TimeoutError");

const spyFetch = () => vi.spyOn(globalThis, "fetch");
type FetchSpy = ReturnType<typeof spyFetch>;
/** The JSON the Nth request (0-based) carried. */
const sent = (f: FetchSpy, n: number) =>
  JSON.parse(String((f.mock.calls[n]![1] as RequestInit).body)) as Record<string, unknown>;

describe("the key is minted once, when the form mounts", () => {
  it("fills the hidden input with a key the CRM's door accepts", () => {
    const c = mount();
    expect(keyInput(c).value).toMatch(KEY_SHAPE);
  });

  it("mints a different key for every form on the page", () => {
    const listing = mount();
    const contact = mount({});
    expect(keyInput(contact).value).toMatch(KEY_SHAPE);
    expect(keyInput(contact).value).not.toBe(keyInput(listing).value);
  });
});

describe("every attempt from one form carries the same key", () => {
  it("the first request carries the mounted key", async () => {
    const f = spyFetch().mockResolvedValue(reply(202, { ok: true }));
    const c = mount();
    const key = keyInput(c).value;
    fillIn(c);
    await press(c);
    expect(f).toHaveBeenCalledTimes(1);
    expect(sent(f, 0).enquiry_key).toBe(key);
  });

  it("after a 429 the form is usable again, says why, and the next press sends the SAME key", async () => {
    const f = spyFetch()
      .mockResolvedValueOnce(reply(429, { error: "Too many enquiries from this address. Please try again shortly." }))
      .mockResolvedValueOnce(reply(202, { ok: true }));
    const c = mount();
    const key = keyInput(c).value;
    fillIn(c);
    await press(c);
    expect(sendButton(c).disabled, "usable again after the refusal").toBe(false);
    expect(alertText(c)).toContain("Too many enquiries");
    await press(c);
    expect(f).toHaveBeenCalledTimes(2);
    expect(sent(f, 0).enquiry_key).toBe(key);
    expect(sent(f, 1).enquiry_key, "the second press is the same enquiry").toBe(key);
  });

  it("after the connection fell over, the next press sends the same key", async () => {
    const f = spyFetch().mockRejectedValueOnce(connectionLost()).mockResolvedValueOnce(reply(202));
    const c = mount();
    const key = keyInput(c).value;
    fillIn(c);
    await press(c);
    expect(sendButton(c).disabled).toBe(false);
    expect(alertText(c)).toContain("That did not send");
    await press(c);
    expect(sent(f, 1).enquiry_key).toBe(key);
  });

  it("after a timeout — the row may already have committed — the next press sends the same key", async () => {
    // This is the case the key exists for: the CRM commits in under a second
    // and answers after, so a lost answer is not a lost enquiry. Only the
    // same key makes the retry a replay (0096) rather than a second lead.
    const f = spyFetch().mockRejectedValueOnce(timedOut()).mockResolvedValueOnce(reply(202));
    const c = mount();
    const key = keyInput(c).value;
    fillIn(c);
    await press(c);
    await press(c);
    expect(f).toHaveBeenCalledTimes(2);
    expect(sent(f, 1).enquiry_key).toBe(key);
  });

  it("survives the form's own refusal — a key is not spent on a request that never went", async () => {
    // No email and no phone: the form refuses before fetch, moves focus to
    // the email field and re-renders with the message. That re-render used to
    // be enough to lose the key.
    const f = spyFetch().mockResolvedValue(reply(202));
    const c = mount();
    const key = keyInput(c).value;
    fillIn(c, { email: "" });
    await press(c);
    expect(f).not.toHaveBeenCalled();
    expect(alertText(c)).toMatch(/email address or a phone number/);
    expect(document.activeElement).toBe(q(c, 'input[name="email"]'));
    q<HTMLInputElement>(c, 'input[name="email"]').value = "buyer@example.invalid";
    await press(c);
    expect(f).toHaveBeenCalledTimes(1);
    expect(sent(f, 0).enquiry_key).toBe(key);
  });

  it("keeps the hidden input in step with what is sent, across re-renders", async () => {
    spyFetch().mockResolvedValueOnce(reply(429, { error: "Too many." })).mockResolvedValueOnce(reply(202));
    const c = mount();
    const key = keyInput(c).value;
    fillIn(c);
    await press(c);
    expect(keyInput(c).value, "after the refusal re-rendered the form").toBe(key);
  });
});

describe("a key belongs to one form, not to the page", () => {
  it("after a success the form is gone, and a fresh form mints a fresh key", async () => {
    spyFetch().mockResolvedValue(reply(202, { ok: true }));
    const c = mount();
    const key = keyInput(c).value;
    fillIn(c);
    await press(c);
    expect(c.querySelector("form"), "the form is replaced by the thank-you").toBeNull();
    expect(q<HTMLElement>(c, '[role="status"]').textContent).toContain("reached us");
    const next = mount();
    expect(keyInput(next).value).toMatch(KEY_SHAPE);
    expect(keyInput(next).value, "a sent key is never reused").not.toBe(key);
  });
});

describe("what does not change", () => {
  it("consent, the reference, the honeypot and the abort signal travel as before", async () => {
    const f = spyFetch().mockResolvedValue(reply(202));
    const c = mount({ reference: "PAF0001" });
    fillIn(c);
    await press(c);
    const body = sent(f, 0);
    expect(body.consent).toBe(true);
    expect(body.property_reference).toBe("PAF0001");
    expect(body.website).toBe("");
    expect(body.name).toBe("A Buyer");
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.signal, "the browser's own wait outlasts the route's two attempts").toBeInstanceOf(AbortSignal);
  });

  it("a refusal the route did not explain gets the form's own sentence, and the button back", async () => {
    spyFetch().mockResolvedValueOnce(reply(503, {}));
    const c = mount();
    fillIn(c);
    await press(c);
    expect(alertText(c)).toBe("That did not send. Please call or WhatsApp us instead.");
    expect(sendButton(c).disabled).toBe(false);
  });

  it("without JavaScript the form still POSTs to the route, so no field ever lands in the URL", () => {
    // A form with no action falls back to GET against the current document —
    // name, email, phone and message in the address bar, history and logs.
    const html = renderToStaticMarkup(createElement(EnquiryForm, { reference: "PAF0001" }));
    const form = /<form[^>]*>/.exec(html);
    expect(form).not.toBeNull();
    expect(form![0]).toMatch(/action="\/api\/enquiry"/);
    expect(form![0]).toMatch(/method="post"/i);
    // and the key is empty until the browser mints one: the no-JavaScript
    // path posts without a key, which the route treats as "none" (route.test.ts)
    const key = /<input[^>]*name="enquiry_key"[^>]*>/.exec(html);
    expect(key).not.toBeNull();
    expect(key![0]).not.toMatch(/value="[^"]+"/);
  });
});
