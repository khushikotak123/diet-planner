# Security Audit — `khushikotak123/diet-planner`

Scan date: 2026-04-17.

This audit covered the Express backend (`server.js`), static frontend pages,
and npm dependencies. The app has no database, so SQL injection is not
applicable. There are also no authentication checks today (the app has no
user accounts), so the concern is API abuse rather than per-user authz.

## Summary

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | Static file serving exposes server source / `.env` | **Critical** | Fixed |
| 2 | `/send-sms` has no auth, no rate limit, weak input validation (toll fraud / SMS pumping) | **Critical** | Fixed |
| 3 | `/diet` has no rate limit; unvalidated input sent to Gemini (cost abuse + prompt injection surface) | **High** | Fixed |
| 4 | CORS is wide open (`app.use(cors())`) | **High** | Fixed |
| 5 | Vulnerable dependencies (4 high, 2 moderate, 1 low — `express`, `jws`, `path-to-regexp`, `qs`, `axios`, `follow-redirects`, `body-parser`) | **High** | Fixed |
| 6 | Error responses leak internal `err.message` | Medium | Fixed |
| 7 | Full Gemini API response logged to stdout | Medium | Fixed |
| 8 | XSS — AI-generated diet text rendered via `innerHTML` (prompt injection → stored/reflected XSS) | Medium | Fixed |
| 9 | XSS — user-controlled medication / meal / grocery names rendered via `innerHTML` | Medium | Fixed |
| 10 | No `.gitignore` — risk of committing `.env` / `node_modules` | Medium | Fixed |
| 11 | No body-size limit — DoS via huge JSON payloads | Medium | Fixed |
| 12 | No security headers (Helmet) | Low | Fixed |
| 13 | Prompt injection: user-controlled strings (allergies, goal) interpolated verbatim into Gemini prompt | Low | Partially fixed (enum validation + control-char stripping; full prompt-injection defense is a larger design change) |
| 14 | No hardcoded secrets found in source | — | N/A |
| 15 | No SQL used (no DB) | — | N/A |
| 16 | No exposed debug endpoints | — | N/A |

## Details

### 1. Static file serving exposed everything in the repo root (Critical)

`server.js` used `app.use(express.static(__dirname))`, which served *every*
file in the repo directory. That means `http://<host>/server.js`,
`/package.json`, and `/package-lock.json` were publicly fetchable. Express
`static` ignores dotfiles by default so `.env` would be 404, but
`dotfiles: 'ignore'` still lists them as 404 rather than denying, and any
other secrets placed in the repo root (e.g. `credentials.json`,
`service-account.json`) would have been exposed.

**Fix.** Moved all frontend assets (`*.html`, `css/`, `js/`) into a new
`public/` directory and serve **only** that directory, with
`dotfiles: 'deny'`.

```js
app.use(express.static(join(__dirname, "public"), {
  dotfiles: "deny",
  index: "index.html",
}));
```

### 2. `/send-sms` is a free SMS gateway (Critical)

- No authentication — anyone on the internet can POST to `/send-sms`.
- No rate limiting — an attacker can loop the endpoint to drain the
  Twilio balance (SMS pumping / toll fraud).
- Phone number was not validated — `phoneNumber` was passed straight to
  Twilio, so an attacker could target arbitrary (premium-rate) numbers.
- Message body had no length cap.

**Fix.**
- Added `express-rate-limit` (5 req / 15 min per IP).
- Added strict E.164 validation: `/^\+[1-9]\d{7,14}$/`.
- Added 320-char cap on the message and stripped ASCII control characters.
- CORS now restricts cross-origin callers to an explicit allowlist.

> NB: This mitigates opportunistic abuse but not a determined attacker
> who can rotate IPs. Adding a shared-secret header or per-user auth is
> recommended as follow-up before making the SMS endpoint publicly
> reachable in production.

### 3. `/diet` — unvalidated input + unlimited Gemini calls (High)

- `age`, `height`, `weight`, `gender`, etc. were forwarded to the Gemini
  prompt without validation, so malformed or malicious payloads (e.g.
  10 MB allergy string, nested objects, prompt-injection strings) hit
  the upstream API on every request.
- No rate limiting, so anyone could burn the Gemini quota.

**Fix.** Added `validateDietInput()` that:
- bounds numeric fields (`age` 10–120, `height` 50–300, `weight` 20–500,
  `targetCalories` 800–6000, macros 0–2000),
- allowlists `gender`, `goal`, `dietType`, `activityLevel`,
- caps `allergies` at 200 chars and strips control characters,
and an `express-rate-limit` of 20 req / 15 min per IP.

### 4. CORS was wide open (High)

`app.use(cors())` sent `Access-Control-Allow-Origin: *` on every
response, so any website visited by a user could POST to `/send-sms` or
`/diet` from the browser (CSRF-style abuse).

**Fix.** CORS now uses an explicit allowlist from
`ALLOWED_ORIGINS` (comma-separated). Requests with no `Origin`
(same-origin, curl) are accepted; cross-origin requests are rejected
unless the origin is allowlisted.

### 5. Vulnerable dependencies (High)

`npm audit` reported **7 vulnerabilities** (1 low, 2 moderate, 4 high):

| Package | Severity | CVE/Advisory |
|---|---|---|
| `express` (<=4.21.2) | high | transitively pulls vulnerable `body-parser`, `path-to-regexp`, `qs` |
| `path-to-regexp` (<0.1.13) | high | [GHSA-37ch-88jc-xwx2](https://github.com/advisories/GHSA-37ch-88jc-xwx2) (ReDoS) |
| `jws` (<3.2.3) | high | [GHSA-869p-cjfg-cm3x](https://github.com/advisories/GHSA-869p-cjfg-cm3x) (HMAC bypass) |
| `axios` (1.0.0–1.14.0) | high | [GHSA-43fc-jf86-j433](https://github.com/advisories/GHSA-43fc-jf86-j433) (DoS via `__proto__`) + SSRF / header-injection advisories |
| `qs` (<=6.14.1) | moderate | arrayLimit bypass DoS |
| `follow-redirects` (<=1.15.11) | moderate | leaks auth headers on cross-domain redirects |
| `body-parser` (1.19.0–1.20.3) | low | via `qs` |

**Fix.** `npm audit fix` — 0 vulnerabilities remaining.

### 6. Error responses leaked `err.message` (Medium)

`/diet` returned `res.status(500).json({ error: err.message })`, which
would expose upstream API error details, stack fragments, and file
paths to the caller.

**Fix.** Errors are now logged server-side and a generic message is
returned to the client.

### 7. Verbose logging of the full Gemini response (Medium)

`console.log("Gemini raw response:", JSON.stringify(data, null, 2))`
would have dumped full upstream response bodies (including any
sensitive data in generated content) into logs.

**Fix.** Removed.

### 8. & 9. XSS in frontend rendering (Medium)

Multiple pages built HTML via template literals + `innerHTML` using
user-controlled or AI-controlled strings:

- `diet.html` — rendered `plan.notes`, `meal.meal`, `meal.items[]`,
  `snack.items[]` from the Gemini response directly. Gemini responses
  are attacker-influenced (prompt injection through the `allergies`
  field, etc.), so malicious HTML could have been stored/reflected.
- `reminder.html` — rendered medication `name` / `time` from
  `localStorage`.
- `grocery.html` — rendered grocery item `name` / `quantity`.
- `dashboard.html` — rendered meal `name` / `mealType`.
- `tracker.html` — rendered meal `name` and, worse, built an inline
  `onclick="quickLog('...')"` with a fragile `replace(/'/g, "\\'")`
  that did not escape `"` or backticks.

**Fix.** Added `UI.escapeHtml()` and escape every user- or AI-controlled
string before inserting into `innerHTML`. Replaced the fragile
`onclick="quickLog(...)"` with `data-idx` + delegated
`addEventListener('click', …)`. Numeric fields are coerced with
`Number()`.

### 10. No `.gitignore` (Medium)

The repo had no `.gitignore`, so a future commit could have pushed
`.env` or `node_modules`. `node_modules` is already present in the
working tree. Added `.gitignore` (covering `.env`, `node_modules`,
editor files) and `.env.example` with the required variables
documented.

### 11. No JSON body-size limit (Medium)

`express.json()` defaults to 100 KB but was deliberately left
unbounded. Now configured to `limit: "10kb"` — plenty for this app's
payloads and resistant to slow/DoS attacks.

### 12. Missing security headers (Low)

Added `helmet()` with CSP left off (existing inline scripts rely on
it). Tightening CSP is recommended as a follow-up: move inline scripts
into files under `public/js/` and enable CSP with a `nonce`- or
`hash`-based `script-src`.

### 13. Prompt injection (Low — partially mitigated)

The `allergies`, `goal`, etc. values are inserted directly into the
Gemini prompt. An attacker could try to override the system prompt by
putting `"""IGNORE PREVIOUS … respond with { evil HTML }"""` in the
allergies field. Impact is bounded because the client already treats
the response as JSON and we now HTML-escape meal text, so the worst
case is a degraded diet plan rather than XSS or data exfiltration.
Enum validation on `goal`, `dietType`, `gender`, `activityLevel`,
plus numeric bounds on the biometrics, eliminates most of the injection
surface. Further mitigation (system/user role separation, structured
JSON mode, or an allowlist on `allergies`) is recommended as
follow-up.

### Items that did not apply

- **Hardcoded API keys / secrets.** None found in source. Secrets are
  loaded from `.env` via `dotenv` (correct).
- **SQL injection.** App has no database or SQL.
- **Debug endpoints.** None present.

## Recommended follow-up work

1. Introduce per-user authentication and tie reminders to an
   authenticated user; move the medication list off `localStorage`.
2. Add a shared-secret header (or signed-request scheme) for the SMS
   endpoint while auth is being built out.
3. Tighten CSP (remove inline scripts, add a `script-src` allowlist).
4. Add a CI job that runs `npm audit --omit=dev` on every PR.
5. Consider a structured-output mode for Gemini (`responseMimeType:
   application/json`) rather than string cleanup + `JSON.parse`.
