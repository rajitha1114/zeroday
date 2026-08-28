/**
 * z3roday.com — Cloudflare Worker
 *
 * Serves the static site from ./public via the ASSETS binding, and handles
 * POST /api/enquiry by forwarding the form to your inbox through Resend.
 *
 * Required secrets (see README):
 *   RESEND_API_KEY   your Resend API key
 *   ENQUIRY_TO       where enquiries land, e.g. hello@z3roday.com
 *   ENQUIRY_FROM     a verified sender on your domain, e.g. site@z3roday.com
 */

const FIELDS = ["name", "company", "email", "driver", "deadline", "message"];
const MAX_LEN = 4000;

function esc(s) {
  return String(s == null ? "" : s)
    .slice(0, MAX_LEN)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function readSubmission(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json();
  const form = await request.formData();
  const out = {};
  for (const [k, v] of form.entries()) out[k] = v;
  return out;
}

async function handleEnquiry(request, env) {
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  // Only accept posts that came from our own origin.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ error: "bad origin" }, 403);
  }

  let data;
  try {
    data = await readSubmission(request);
  } catch (_) {
    return json({ error: "unreadable" }, 400);
  }

  // Honeypot: real people leave this empty. Return 200 so bots think they won.
  if (data._gotcha) return json({ ok: true });

  if (!data.email || !String(data.email).includes("@")) {
    return json({ error: "email required" }, 400);
  }

  const rows = FIELDS.filter((f) => data[f])
    .map((f) => `<tr><td style="padding:4px 14px 4px 0;color:#667;font:12px monospace;text-transform:uppercase;vertical-align:top">${f}</td><td style="padding:4px 0">${esc(data[f]).replace(/\n/g, "<br>")}</td></tr>`)
    .join("");

  const html =
    `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif">` +
    `<p style="margin:0 0 14px"><strong>New enquiry from z3roday.com</strong></p>` +
    `<table cellpadding="0" cellspacing="0">${rows}</table>` +
    `</div>`;

  if (!env.RESEND_API_KEY) {
    // Not configured yet — log it so nothing is silently lost, and don't
    // pretend to the visitor that it sent.
    console.log("ENQUIRY (email not configured):", JSON.stringify(data));
    return json({ error: "email not configured" }, 500);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.ENQUIRY_FROM,
      to: [env.ENQUIRY_TO],
      reply_to: String(data.email).slice(0, 200),
      subject: `Enquiry — ${esc(data.company || data.name || "website")}`,
      html,
    }),
  });

  if (!res.ok) {
    console.log("Resend failed:", res.status, await res.text());
    return json({ error: "send failed" }, 502);
  }

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/enquiry") {
      return handleEnquiry(request, env);
    }

    // Everything else is served from ./public by the assets binding.
    return env.ASSETS.fetch(request);
  },
};
