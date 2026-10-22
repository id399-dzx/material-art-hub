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
