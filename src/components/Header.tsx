"use client";

import { Box, LogOut, Upload, BarChart2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Header() {
    const router = useRouter();
    const [session, setSession] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        async function checkAuth() {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            setSession(currentSession);
            if (currentSession?.user?.email) {
                const email = currentSession.user.email;
                setUserName(email.split('@')[0]);
                setIsAdmin(email === 'id19991016@gmail.com');
            }
        }
        checkAuth();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    return (
        <header className="h-16 border-b border-slate-800 flex flex-shrink-0 items-center justify-between px-8 bg-slate-900/50 backdrop-blur-sm z-10 w-full">
            {/* Logo / Home Link side */}
            <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl tracking-wider hover:opacity-80 transition-opacity">
                    <Box className="text-blue-500" />
                    <span>MaterialArt Hub</span>
                </Link>

                <div className="hidden md:flex items-center gap-4 border-l border-slate-700 pl-6 ml-2">
                    <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                        发现探索
                    </Link>
                    <Link href="/data-processing" className="text-sm font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors">
                        <BarChart2 size={16} className="text-indigo-400" />
                        数据处理
                    </Link>
                </div>
            </div>

            {/* Auth / Action side */}
            <div className="flex items-center gap-3">
                {session ? (
                    <>
                        {isAdmin ? (
                            <span className="text-sm font-bold text-blue-400 hidden sm:inline mr-2">🧑‍💻 管理员: {userName}</span>
                        ) : (
                            <span className="text-sm font-bold text-slate-400 hidden sm:inline mr-2">👤 用户: {userName}</span>
                        )}

                        {isAdmin && (
                            <button
                                onClick={() => router.push('/upload')}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                            >
                                <Upload size={16} /> 发布素材
                            </button>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="flex items-center justify-center p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors opacity-60 hover:opacity-100"
                            title="退出登录"
                        >
                            <LogOut size={18} />
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => router.push('/login')}
                        className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        登录 / 注册
                    </button>
                )}
            </div>
        </header>
    );
}
