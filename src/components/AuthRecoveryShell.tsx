import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, LockKeyhole } from "lucide-react";
import "@/app/login/login.css";

export default function AuthRecoveryShell({ title, description, children }: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <main className="auth-workbench">
            <div className="auth-shell">
                <Link href="/login" className="auth-back"><ArrowLeft size={17} /> 返回登录</Link>
                <div className="auth-layout">
                    <section className="auth-intro" aria-label="账号找回说明">
                        <span className="auth-eyebrow"><span className="auth-eyebrow-dot" /> MATERIALART HUB / RESEARCH WORKSPACE</span>
                        <h1>找回账号，<br /><span>继续你的研究。</span></h1>
                        <p>通过注册邮箱重新设置密码。账号中的科研素材会保留，数据处理工作台也随时可用。</p>
                        <div className="auth-showcase" aria-hidden="true">
                            <div className="auth-showcase-top"><span className="auth-showcase-icon"><BarChart3 size={20} /></span><span>研究工作台</span><span className="auth-showcase-sparkle">✦</span></div>
                            <div className="auth-showcase-chart"><i /><i /><i /><i /><i /><i /><i /></div>
                            <div className="auth-showcase-bottom"><span>数据可视化</span><span>素材归档</span><span>清晰呈现</span></div>
                        </div>
                    </section>
                    <section className="auth-panel" aria-labelledby="auth-heading">
                        <div className="auth-panel-ornament" aria-hidden="true" />
                        <div className="auth-panel-content">
                            <div className="auth-panel-icon"><LockKeyhole size={23} /></div>
                            <span className="auth-panel-kicker">MaterialArt Hub · 账号找回</span>
                            <h2 id="auth-heading">{title}</h2>
                            <p className="auth-panel-description">{description}</p>
                            {children}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
