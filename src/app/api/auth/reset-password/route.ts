import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth/password-recovery";

const responseHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
        return NextResponse.json({ message: "请求来源无效。" }, { status: 403, headers: responseHeaders });
    }
    if (Number(request.headers.get("content-length")) > 4096) {
        return NextResponse.json({ message: "请求内容过长。" }, { status: 413, headers: responseHeaders });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ message: "请求格式无效。" }, { status: 400, headers: responseHeaders }); }
    if (!body || typeof body !== "object") {
        return NextResponse.json({ message: "请求格式无效。" }, { status: 400, headers: responseHeaders });
    }

    try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const result = await resetPasswordWithToken(supabase.auth, body.tokenHash, body.password);
        return NextResponse.json({ message: result.message, invalidLink: result.invalidLink }, { status: result.status, headers: responseHeaders });
    } catch {
        // Never log recovery proofs, passwords or provider responses.
        return NextResponse.json({ message: "暂时无法确认重置结果。请先尝试使用新密码登录；如未成功，请重新申请重置邮件。", invalidLink: true }, { status: 503, headers: responseHeaders });
    }
}
