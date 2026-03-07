"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Lock, Mail, ArrowLeft, Loader2, KeyRound, Box } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLogin, setIsLogin] = useState(true);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (authError) throw authError;
            } else {
                const { error: authError, data } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (authError) throw authError;
                if (data.user && data.session === null) {
                    // Optional: handle email confirmation case if configured in Supabase
                    setError("注册成功！请检查您的邮箱进行验证。");
                    setLoading(false);
                    return;
                }
            }

            // Redirect on success
            window.location.href = "/";

        } catch (err: any) {
            console.error("Auth Error:", err);
            // Translate common error messages
            if (err.message?.includes("Invalid login")) {
                setError("邮箱或密码错误，请重新输入。");
            } else if (err.message?.includes("User already registered")) {
                setError("该邮箱已被注册，请直接登录。");
            } else if (err.message?.includes("Password should be at least")) {
                setError("密码长度至少需要 6 个字符。");
            } else {
                setError(err.message || (isLogin ? "登录失败，请稍后重试。" : "注册失败，请检查输入或稍后重试。"));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans flex flex-col relative overflow-hidden">

            {/* Background Decorations */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

            {/* Navbar Area (Simple) */}
            <div className="w-full h-20 flex items-center px-8 relative z-10">
                <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group p-2 -ml-2 rounded-xl hover:bg-slate-900/50">
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold tracking-widest uppercase">返回系统</span>
                </Link>
            </div>

            {/* Login Card Container */}
            <div className="flex-1 flex items-center justify-center p-6 relative z-10">
                <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-[2rem] p-8 md:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">

                    {/* Inner glowing rim */}
                    <div className="absolute inset-0 border border-white/5 rounded-[2rem] pointer-events-none" />

                    {/* Logo/Header */}
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(37,99,235,0.4)]">
                            <Box size={32} className="text-white drop-shadow-md" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
                            {isLogin ? "用户登录" : "创建账号"}
                        </h1>
                        <p className="text-slate-400 text-sm font-medium tracking-wide">
                            MaterialArt Hub • {isLogin ? "安全验证" : "欢迎加入"}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">

                        {/* Error Message */}
                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <KeyRound size={18} className="shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">账号邮箱</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="admin@example.com"
                                    className="w-full bg-slate-950/60 border border-slate-700/50 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">安全密码</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950/60 border border-slate-700/50 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 mt-2 rounded-2xl font-bold text-white transition-all duration-300 relative overflow-hidden
                                ${loading
                                    ? 'bg-slate-800 cursor-not-allowed text-slate-400 border border-slate-700'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:-translate-y-0.5'
                                }`}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>处理中...</span>
                                </div>
                            ) : (
                                <span>{isLogin ? "安全登录" : "立即注册"}</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError(null);
                            }}
                            className="text-sm font-medium text-slate-400 hover:text-blue-400 transition-colors"
                        >
                            {isLogin ? "没有账号？点击注册新用户" : "已有账号？点击此处登录"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
