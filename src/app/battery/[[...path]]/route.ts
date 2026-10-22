import { NextRequest, NextResponse } from 'next/server';
import { batteryAppLocation } from '@/lib/battery-app';
import connection from '@/lib/battery-app-origin.json';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  const location = batteryAppLocation(process.env.BATTERY_APP_ORIGIN ?? connection.origin, request.url, path);
  if (!location) return new NextResponse('完整电池资讯服务尚未连接。', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const response = NextResponse.redirect(location, 307);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const HEAD = GET;
