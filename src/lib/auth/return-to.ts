/** Only allow a relative destination within this website after signing in. */
export function safeReturnTo(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const destination = new URL(value, "https://fesilent.invalid");
    const decodedPath = decodeURIComponent(destination.pathname).replace(/\/+$/, "") || "/";
    if (destination.origin !== "https://fesilent.invalid" || decodedPath.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decodedPath) || ["/login", "/auth/callback"].includes(decodedPath)) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch { return fallback; }
}

export function loginUrl(returnTo: string): string {
  return `/login?next=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
