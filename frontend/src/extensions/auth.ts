/**
 * Frontend half of the auth hook (backend half: backend/app/auth.py).
 *
 * Every API request merges these headers in. The base is a single local user and
 * sends nothing extra; a fork with sign-in returns e.g. { Authorization: "Bearer …" }
 * here, or relies on a same-origin session cookie and leaves this empty.
 */
export function authHeaders(): Record<string, string> {
  return {};
}

/** Called when the backend answers 401. Redirect to your sign-in page here. */
export function onUnauthorized(): void {}
