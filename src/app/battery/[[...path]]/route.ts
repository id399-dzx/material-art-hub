import { NextRequest, NextResponse } from 'next/server';
import { batteryAppIsAvailable, batteryAppLocation } from '@/lib/battery-app';
import connection from '@/lib/battery-app-origin.json';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  const origin = process.env.BATTERY_APP_ORIGIN ?? connection.origin;
  if (!await batteryAppIsAvailable(origin, request.url)) {
    return new NextResponse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>电池资讯暂不可用 · Fesilent</title></head><body style="margin:0;background:#f7f7fa;color:#282635;font:16px/1.8 system-ui,sans-serif"><main style="max-width:560px;margin:15vh auto;padding:28px"><p>FESILENT</p><h1>电池资讯暂不可用</h1><p>资讯服务当前未连接，请稍后重试。科研素材、数据处理与工具仍可正常使用。</p><p><a href="/reverie">进入科研主页</a> · <a href="/data-processing">打开数据处理</a></p><p><a href="/battery">重新尝试连接资讯服务</a></p></main></body></html>`, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' },
    });
  }
  const location = batteryAppLocation(origin, request.url, path)!;
  const response = NextResponse.redirect(location, 307);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const HEAD = GET;
