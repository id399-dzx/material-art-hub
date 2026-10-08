"use client";

import { BarChart2, Box, ChartNoAxesCombined, FileText, GraduationCap, LogOut, Puzzle, Settings2, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import "./Header.css";

export default function Header() {
    const pathname = usePathname();
    const [session, setSession] = useState<Session | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            if (!mounted) return;
            setSession(currentSession);
            setUserName(currentSession?.user.email?.split("@")[0] ?? null);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            if (!mounted) return;
            setSession(currentSession);
            setUserName(currentSession?.user.email?.split("@")[0] ?? null);
        });
        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const isAdmin = session?.user.email === "id19991016@gmail.com";
    const isDiscovery = pathname === "/" || pathname.startsWith("/asset/");
    const workspaces = [
        { href: "/chart-examples", label: "数据图示例", icon: ChartNoAxesCombined },
        { href: "/data-processing", label: "数据处理", icon: BarChart2 },
        { href: "/research-skills", label: "科研 Skill", icon: GraduationCap },
        { href: "/paper-formatting", label: "论文排版", icon: FileText },
        { href: "/software-plugins", label: "软件插件", icon: Puzzle },
    ];

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    return (
        <header className="site-header">
            <div className="site-header__inner">
                <Link href="/" className="site-header__brand" aria-label="Fesilent Reverie 首页">
                    <span className="site-header__brand-icon"><Box size={23} strokeWidth={2} /></span>
                    <span>Fesilent Reverie</span>
                </Link>

                <nav className="site-header__nav" aria-label="主导航">
                    <Link href="/" className="site-header__nav-link" aria-current={isDiscovery ? "page" : undefined}>
                        发现探索
                    </Link>
                    {workspaces.map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href} className="site-header__nav-link" aria-current={pathname.startsWith(href) ? "page" : undefined}>
                            <Icon size={15} /> {label}
                        </Link>
                    ))}
                </nav>

                <div className="site-header__actions">
                    {session ? (
                        <>
                            <span className="site-header__user" title={session.user.email ?? undefined}>
                                <span className="site-header__avatar" aria-hidden="true">{userName?.slice(0, 1).toUpperCase() || "U"}</span>
                                <span className="site-header__user-name">{userName}</span>
                            </span>
                            {isAdmin && (
                                <Link href="/admin" className="site-header__login" aria-label="内容管理">
                                    <Settings2 size={15} /> 内容管理
                                </Link>
                            )}
                            {isAdmin && (
                                <Link href={pathname.startsWith("/software-plugins") ? "/software-plugins#publish" : "/upload"} className="site-header__publish" aria-label={pathname.startsWith("/software-plugins") ? "发布插件" : "发布素材"}>
                                    <Upload size={15} /> <span>{pathname.startsWith("/software-plugins") ? "发布插件" : "发布素材"}</span>
                                </Link>
                            )}
                            <button type="button" onClick={handleSignOut} className="site-header__signout" aria-label="退出登录" title="退出登录">
                                <LogOut size={18} />
                            </button>
                        </>
                    ) : (
                        <Link href="/login" className="site-header__login">登录 / 注册</Link>
                    )}
                </div>
            </div>
        </header>
    );
}
