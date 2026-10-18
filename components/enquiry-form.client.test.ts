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

/* ------------------------------------------------------------------------ *
 * The buyer's brief, started from the search (2026-10-18).
 *
 * "Send us this brief" lands at /properties#brief with the search in the
 * URL. The brief fills the fields that mean the same thing — type, area,
 * minimum bedrooms — writes a price ceiling and any typed words into the
 * message in the buyer's own terms (a ceiling does not say which budget
 * band below it is meant), and says what it filled. It never replaces
 * anything the visitor has already chosen or typed.
 * ------------------------------------------------------------------------ */
describe("the buyer's brief, arrived at from a search", () => {
  const AREAS = { Paphos: ["Kato Paphos", "Peyia / Coral Bay"] };
  const brief = () =>
    mount({ variant: "buyer", areas: AREAS, focusOnHash: "#brief", briefFromSearchOnHash: true });
  /* The note's region is in the page from the first render, empty, and the
     note is written into it — so "no note" is an empty region, not none. */
  const status = (c: HTMLElement) => c.querySelector('[role="status"]')!;
  const value = (c: HTMLElement, name: string) =>
    (c.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("fills the fields of the same meaning, and puts the ceiling and the words in the message", () => {
    window.history.replaceState(null, "", "/properties?q=pool&type=villa&area=peyia+%2F+coral+bay&beds=3&max=500000#brief");
    const c = brief();
    expect(value(c, "buy_property_type")).toBe("villa");
    expect(value(c, "buy_area")).toBe("Peyia / Coral Bay");
    expect(value(c, "bedrooms_min")).toBe("3");
    expect(value(c, "budget")).toBe("");
    expect(value(c, "message")).toBe("From my search on the site: up to €500k, “pool”.");
    expect(status(c).textContent).toContain("Villa · Peyia / Coral Bay · 3+ bedrooms · Up to €500k · “pool”");
  });

  it("does nothing when the page was not arrived at as the brief", () => {
    window.history.replaceState(null, "", "/properties?type=villa");
    const c = brief();
    expect(value(c, "buy_property_type")).toBe("");
    expect(status(c).textContent).toBe("");
  });

  it("has the note's live region in the page, empty, before anything fills it", () => {
    window.history.replaceState(null, "", "/properties");
    const c = brief();
    expect(c.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(status(c).textContent).toBe("");
  });

  it("never replaces what the visitor already chose or typed", () => {
    window.history.replaceState(null, "", "/properties?type=villa");
    const c = brief();
    const type = c.querySelector<HTMLSelectElement>('[name="buy_property_type"]')!;
    const message = c.querySelector<HTMLTextAreaElement>('[name="message"]')!;
    type.value = "apartment";
    message.value = "Sea view, please.";
    act(() => {
      window.history.replaceState(null, "", "/properties?type=villa&max=500000#brief");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(type.value).toBe("apartment");
    expect(message.value).toBe("Sea view, please.");
    // and says nothing it did not do: neither "Villa" nor the ceiling went in
    expect(status(c).textContent).toBe("");
  });

  it("names only what it wrote when some fields were already chosen", () => {
    window.history.replaceState(null, "", "/properties");
    const c = brief();
    c.querySelector<HTMLSelectElement>('[name="buy_property_type"]')!.value = "apartment";
    act(() => {
      window.history.replaceState(null, "", "/properties?type=villa&beds=3#brief");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(value(c, "buy_property_type")).toBe("apartment");
    expect(value(c, "bedrooms_min")).toBe("3");
    expect(status(c).textContent).toContain("Started from your search: 3+ bedrooms.");
    expect(status(c).textContent).not.toContain("Villa");
  });

  it("keeps what it filled through the re-render its own note causes", () => {
    window.history.replaceState(null, "", "/properties?type=land#brief");
    const c = brief();
    expect(status(c).textContent).toContain("Land");
    expect(value(c, "buy_property_type")).toBe("land");
  });

  it("puts an area the picker does not offer into the message, rather than picking something else", () => {
    window.history.replaceState(null, "", "/properties?area=Limassol#brief");
    const c = brief();
    expect(value(c, "buy_area")).toBe("");
    expect(value(c, "message")).toBe("From my search on the site: in Limassol.");
    expect(status(c).textContent).toContain("Started from your search: Limassol.");
  });

  it("replaces what an earlier search wrote, but never what the visitor chose", () => {
    window.history.replaceState(null, "", "/properties?type=villa&beds=3#brief");
    const c = brief();
    expect(value(c, "buy_property_type")).toBe("villa");
    c.querySelector<HTMLInputElement>('[name="bedrooms_min"]')!.value = "4"; // the visitor's own
    act(() => {
      window.history.replaceState(null, "", "/properties?type=land#brief-again");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      window.history.replaceState(null, "", "/properties?type=land#brief");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(value(c, "buy_property_type")).toBe("land");
    expect(value(c, "bedrooms_min")).toBe("4");
    expect(status(c).textContent).toContain("Started from your search: Land.");
    expect(status(c).textContent).not.toContain("Villa");
  });
});

describe("a second brief after one was sent", () => {
  /* Review 2026-10-18: after a sent brief, "Send us this brief" for a new
     search jumped to the old "Thank you — that has reached us." — telling
     the visitor a search had been sent that never was. A new arrival at the
     brief starts a fresh form, from the new search, under a NEW key: it is a
     second enquiry, not a retry of the first. */
  it("starts a fresh form from the new search, with a new key", async () => {
    const f = spyFetch().mockResolvedValue(reply(202, { ok: true }));
    window.history.replaceState(null, "", "/properties?type=villa#brief");
    const c = mount({ variant: "buyer", areas: { Paphos: ["Kato Paphos"] }, focusOnHash: "#brief", briefFromSearchOnHash: true });
    const first = keyInput(c).value;
    fillIn(c);
    await press(c);
    expect(f).toHaveBeenCalledTimes(1);
    expect(c.textContent).toContain("Thank you");

    act(() => {
      window.history.replaceState(null, "", "/properties?type=land");
      window.history.replaceState(null, "", "/properties?type=land#brief");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(c.textContent).not.toContain("Thank you");
    expect(q<HTMLSelectElement>(c, '[name="buy_property_type"]').value).toBe("land");
    expect(keyInput(c).value).toMatch(KEY_SHAPE);
    expect(keyInput(c).value).not.toBe(first);
    expect(document.activeElement?.getAttribute("name")).toBe("name");
    window.history.replaceState(null, "", "/");
  });
});
