'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { LogOut, User as UserIcon, Loader2, Github } from 'lucide-react';

export default function AuthButton() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setLoading(false);
        };
        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
            }
        );

        return () => subscription.unsubscribe();
    }, [supabase.auth]);

    const handleGitHubLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: `${location.origin}/auth/callback`,
            },
        });
    };

    const handleLogout = async () => {
        setLoading(true);
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
    };

    if (loading) {
        return (
            <button disabled className="ml-4 px-5 py-2 bg-slate-800 text-slate-400 text-sm font-medium rounded-full flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> 校验中...
            </button>
        );
    }

    if (user) {
        return (
            <div className="ml-4 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 py-1.5 px-3 rounded-full border border-slate-700/50">
                    <img
                        src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                        alt="avatar"
                        className="w-6 h-6 rounded-full bg-slate-700"
                    />
                    <span className="hidden sm:inline-block max-w-[100px] truncate">{user.user_metadata?.user_name || user.email}</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-white hover:bg-red-500/20 rounded-full transition-colors group"
                    title="退出登录"
                >
                    <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <button className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-full transition-colors shadow-lg shadow-blue-600/20">
                    上传素材
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleGitHubLogin}
            className="ml-4 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-full transition-all flex items-center gap-2 border border-slate-700 hover:border-slate-500 hover:shadow-lg hover:shadow-white/5 group"
        >
            <Github size={16} className="group-hover:text-blue-400 transition-colors" /> GitHub 登录
        </button>
    );
}
