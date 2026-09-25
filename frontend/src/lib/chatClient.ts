import { authHeaders, onUnauthorized } from "@/extensions/auth";

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
// Must match backend/app/auth.py; the backend rejects writes without it (CSRF guard).
const clientHeader = { "X-Workspace-Client": "local-chat" };
function headers(json: boolean): Record<string, string> {
  return { ...clientHeader, ...authHeaders(), ...(json ? { "Content-Type": "application/json" } : {}) };
}
export async function checkResponse(response: Response) {
  if (response.ok) return;
  if (response.status === 401) onUnauthorized();
  let message = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail)) message = body.detail.map((e: { msg: string; loc: string[] }) => e.loc.slice(1).join(".") + ": " + e.msg).join("; ");
  } catch { /* A proxy can return a non-JSON error. */ }
  throw new Error(message);
}
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);
  try {
    const form = body instanceof FormData;
    const response = await fetch(apiBaseUrl + path, {
      method, signal: controller.signal,
      headers: headers(!form && body !== undefined),
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
    await checkResponse(response);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("Request timed out. Reload to check whether the change was saved.");
    if (error instanceof TypeError) throw new Error("Cannot reach the local backend. Check that it is running.");
    throw error;
  } finally { clearTimeout(timer); }
}
export async function streamReply(path: string, body: unknown, signal: AbortSignal, onEvent: (event: string, data: any) => void) {
  const response = await fetch(apiBaseUrl + path, { method: "POST", signal,
    headers: headers(true), body: JSON.stringify(body) });
  await checkResponse(response);
  if (!response.body) throw new Error("Streaming is unavailable in this browser.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const lines = frame.split("\n");
        const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
        const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
        if (event && data) { onEvent(event, JSON.parse(data)); if (event === "done") completed = true; }
      }
      if (done) break;
    }
    if (!completed) throw new Error("Connection interrupted. Partial output was saved; reload before retrying.");
  } finally { reader.releaseLock(); }
}
export function download(name: string, content: string, mime = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
