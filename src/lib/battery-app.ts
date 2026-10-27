/** Product integration forwards to the original app, preserving its routes, API and browser storage. */
export function batteryAppLocation(origin: string, incoming: string, parts: string[] = []) {
  if (!origin) return null;
  const base = new URL(origin);
  const source = new URL(incoming);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash
    || base.pathname !== '/' || base.host === source.host) throw new Error('Invalid battery app origin');
  const target = new URL(base.origin);
  target.pathname = '/' + parts.map(part => encodeURIComponent(part)).join('/');
  target.search = source.search;
  return target;
}

/** Keep an unavailable external app from taking the main site offline. */
export async function batteryAppIsAvailable(origin: string, incoming: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const target = batteryAppLocation(origin, incoming);
    if (!target) return false;
    target.search = '';
    const response = await fetcher(target, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(2500),
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}
