"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, Database, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { isSupabaseConnectionError, supabase } from "@/lib/supabase";
import { safeReturnTo } from "@/lib/auth/return-to";
import "./login.css";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setNotice(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const next = safeReturnTo(new URLSearchParams(window.location.search).get("next"));
                const callback = new URL("/auth/callback", window.location.origin);
                callback.searchParams.set("next", next);
                const { error, data } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback.href } });
                if (error) throw error;
                if (data.user && data.session === null) {
                    setNotice({ type: "success", message: "注册成功，请检查邮箱并完成验证。" });
                    return;
                }
            }

            window.location.href = safeReturnTo(new URLSearchParams(window.location.search).get("next"));
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (isSupabaseConnectionError(error)) {
                setNotice({ type: "error", message: "账号服务暂时无法连接，请稍后重试；若持续出现，请联系管理员。" });
            } else if (message.includes("Invalid login")) {
                setNotice({ type: "error", message: "邮箱或密码错误，请重新输入。" });
            } else if (message.includes("User already registered")) {
                setNotice({ type: "error", message: "该邮箱已被注册，请直接登录。" });
            } else if (message.includes("Password should be at least")) {
                setNotice({ type: "error", message: "密码长度至少需要 6 个字符。" });
            } else {
                setNotice({ type: "error", message: message || (isLogin ? "登录失败，请稍后重试。" : "注册失败，请稍后重试。") });
            }
        } finally {
            setLoading(false);
        }
    };

    const changeMode = () => {
        setIsLogin((current) => !current);
        setNotice(null);
    };

    return (
        <main className="auth-workbench">
            <div className="auth-shell">
                <Link href="/" className="auth-back"><ArrowLeft size={17} /> 返回首页</Link>

                <div className="auth-layout">
                    <section className="auth-intro" aria-label="工作台介绍">
                        <span className="auth-eyebrow"><span className="auth-eyebrow-dot" /> FESILENT REVERIE / RESEARCH WORKSPACE</span>
                        <h1>让灵感与数据，<br /><span>在同一处生长。</span></h1>
                        <p>登录后可查看科研 Skill 详情、整理论文排版和下载自研插件。各个页面与数据处理工作台随时可浏览。</p>

                        <div className="auth-showcase" aria-hidden="true">
                            <div className="auth-showcase-top">
                                <span className="auth-showcase-icon"><BarChart3 size={20} /></span>
                                <span>研究工作台</span>
                                <span className="auth-showcase-sparkle">✦</span>
                            </div>
                            <div className="auth-showcase-chart">
                                <i /><i /><i /><i /><i /><i /><i />
                            </div>
                            <div className="auth-showcase-bottom"><span>数据可视化</span><span>素材归档</span><span>清晰呈现</span></div>
                        </div>
                    </section>

                    <section className="auth-panel" aria-labelledby="auth-heading">
                        <div className="auth-panel-ornament" aria-hidden="true" />
                        <div className="auth-panel-content">
                            <div className="auth-panel-icon"><Database size={23} strokeWidth={1.9} /></div>
                            <span className="auth-panel-kicker">欢迎来到 Fesilent Reverie</span>
                            <h2 id="auth-heading">{isLogin ? "登录工作台" : "创建账号"}</h2>
                            <p className="auth-panel-description">{isLogin ? "输入账号信息，继续你的研究整理。" : "填写邮箱和密码，即可开始使用。"}</p>

                            <div className="auth-mode-switch" role="group" aria-label="账号操作">
                                <button type="button" className={isLogin ? "is-active" : ""} onClick={() => { setIsLogin(true); setNotice(null); }} aria-pressed={isLogin}>登录</button>
                                <button type="button" className={!isLogin ? "is-active" : ""} onClick={() => { setIsLogin(false); setNotice(null); }} aria-pressed={!isLogin}>注册</button>
                            </div>

                            <form onSubmit={handleAuth} className="auth-form">
                                {notice && <div className={"auth-notice auth-notice--" + notice.type} role={notice.type === "error" ? "alert" : "status"}><ShieldCheck size={18} />{notice.message}</div>}

                                <div className="auth-field">
                                    <label htmlFor="auth-email">账号邮箱</label>
                                    <div className="auth-input-wrap"><Mail size={18} aria-hidden="true" /><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></div>
                                </div>

                                <div className="auth-field">
                                    <div className="auth-label-row"><label htmlFor="auth-password">安全密码</label>{isLogin && <Link href="/forgot-password">忘记密码？</Link>}</div>
                                    <div className="auth-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 个字符" minLength={isLogin ? undefined : 6} required /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                                </div>

                                <button type="submit" className="auth-submit" disabled={loading}>{loading ? <><Loader2 size={18} className="auth-spin" /> 处理中...</> : <>{isLogin ? "登录工作台" : "创建账号"}<ArrowRight size={18} /></>}</button>
                            </form>

                            <p className="auth-footnote">{isLogin ? "还没有账号？" : "已有账号？"} <button type="button" onClick={changeMode}>{isLogin ? "立即注册" : "返回登录"}</button></p>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
