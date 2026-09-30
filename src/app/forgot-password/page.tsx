"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import AuthRecoveryShell from "@/components/AuthRecoveryShell";
import { isSupabaseConnectionError, supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [sentTo, setSentTo] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (!cooldown) return;
        const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [cooldown]);

    async function sendResetEmail(event: React.FormEvent) {
        event.preventDefault();
        if (loading || cooldown) return;
        setLoading(true);
        setError("");
        try {
            const address = email.trim();
            const { error: authError } = await supabase.auth.resetPasswordForEmail(address, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (authError) throw authError;
            setSentTo(address);
            setCooldown(60);
        } catch (err) {
            const code = typeof err === "object" && err !== null && "code" in err ? err.code : "";
            if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
                setError("邮件发送过于频繁，请稍后再试；也可以先检查收件箱和垃圾邮件。 ");
                setCooldown(60);
            } else if (code === "email_address_not_authorized") {
                setError("当前邮件服务仅允许向已授权邮箱发送。请联系管理员配置邮件服务后再试。");
            } else {
                setError(isSupabaseConnectionError(err) ? "账号服务暂时无法连接，请检查网络后重试。" : "重置邮件未能发送，请稍后重试；若持续出现，请联系管理员。");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthRecoveryShell title="忘记密码" description="填写注册时使用的邮箱，我们将发送密码重置链接。">
            <form className="auth-form auth-recovery-form" onSubmit={sendResetEmail}>
                {error && <div className="auth-notice" role="alert">{error}</div>}
                {sentTo && <div className="auth-notice auth-notice--success" role="status"><CheckCircle2 size={18} /><span>如果该邮箱已注册，重置邮件将发送至 <strong className="auth-recovery-address">{sentTo}</strong>。请检查收件箱和垃圾邮件，并打开最新邮件中的链接。</span></div>}
                <div className="auth-field">
                    <label htmlFor="recovery-email">账号邮箱</label>
                    <div className="auth-input-wrap"><Mail size={18} aria-hidden="true" /><input id="recovery-email" type="email" autoComplete="email" required value={email} disabled={loading} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></div>
                </div>
                <button type="submit" className="auth-submit" disabled={loading || cooldown > 0}>
                    {loading ? <><Loader2 size={18} className="auth-spin" /> 正在发送...</> : cooldown ? `${cooldown} 秒后可再次发送` : <>{sentTo ? "重新发送重置邮件" : "发送重置邮件"}<ArrowRight size={18} /></>}
                </button>
                <p className="auth-hint">链接仅可使用一次。无需在此提供旧密码；新密码由你在邮件打开的页面中填写。</p>
            </form>
            <p className="auth-footnote">想起密码了？ <Link href="/login">返回登录</Link></p>
        </AuthRecoveryShell>
    );
}
