"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import AuthRecoveryShell from "@/components/AuthRecoveryShell";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordForm({ tokenHash }: { tokenHash: string | null }) {
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [invalidLink, setInvalidLink] = useState(!tokenHash);
    const [complete, setComplete] = useState(false);

    async function resetPassword(event: React.FormEvent) {
        event.preventDefault();
        if (loading || invalidLink || !tokenHash) return;
        if (password !== confirmation) { setError("两次输入的密码不一致，请重新确认。"); return; }
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tokenHash, password }),
            });
            const result = await response.json();
            if (!response.ok) {
                setError(result.message || "密码重置失败，请重新申请邮件后再试。");
                if (result.invalidLink) setInvalidLink(true);
                return;
            }
            setPassword("");
            setConfirmation("");
            setComplete(true);
            window.history.replaceState(null, "", "/reset-password");
            // Remove any stale browser session; the recovery session stays on the server.
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        } catch {
            setError("暂时无法确认重置结果。请先尝试使用新密码登录；如未成功，请重新申请重置邮件。");
            setInvalidLink(true);
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthRecoveryShell title={complete ? "密码已更新" : "设置新密码"} description={complete ? "使用新密码登录，继续你的研究工作。" : "请设置新的账号密码，并再次输入以确认。"}>
            {complete ? <div className="auth-recovery-success"><div className="auth-notice auth-notice--success" role="status"><CheckCircle2 size={18} />密码重置成功，账号资料和素材已保留。</div><Link href="/login" className="auth-submit auth-submit-link">使用新密码登录<ArrowRight size={18} /></Link></div>
                : invalidLink ? <div className="auth-recovery-success"><div className="auth-notice" role="alert">{error || "未找到有效的密码重置链接。请通过邮件中的最新链接打开此页，或重新申请重置邮件。"}</div><Link href="/forgot-password" className="auth-submit auth-submit-link">重新申请重置邮件<ArrowRight size={18} /></Link><p className="auth-footnote"><Link href="/login">返回登录</Link></p></div>
                    : <form className="auth-form auth-recovery-form" onSubmit={resetPassword}>
                        {error && <div className="auth-notice" role="alert">{error}</div>}
                        <div className="auth-field"><label htmlFor="new-password">新密码</label><div className="auth-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} disabled={loading} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" /><button type="button" className="auth-password-toggle" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
                        <div className="auth-field"><label htmlFor="confirm-password">确认新密码</label><div className="auth-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={confirmation} disabled={loading} onChange={(event) => setConfirmation(event.target.value)} placeholder="再次输入新密码" /></div></div>
                        <p className="auth-hint">建议组合使用字母、数字和符号。提交后会验证邮件链接；过期或已使用的链接需要重新申请。</p>
                        <button type="submit" className="auth-submit" disabled={loading}>{loading ? <><Loader2 size={18} className="auth-spin" /> 正在更新...</> : <>确认更新密码<ArrowRight size={18} /></>}</button>
                        <p className="auth-footnote"><Link href="/forgot-password">重新申请重置邮件</Link></p>
                    </form>}
        </AuthRecoveryShell>
    );
}
