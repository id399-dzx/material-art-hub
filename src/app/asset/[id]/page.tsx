"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Download, Image as ImageIcon, Box, Layers, Zap, Activity, Trash2, Loader2, LockKeyhole, CalendarDays } from "lucide-react";
import "./asset-detail.css";

interface AssetDetails {
    id: string;
    title: string;
    description: string;
    image_url: string;
    source_file_url?: string;
    tags_application: string[];
    tags_material: string[];
    tags_process: string[];
    tags_style: string[];
    created_at: string;
}

export default function AssetDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const [asset, setAsset] = useState<AssetDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        async function fetchAssetDetails() {
            if (!params?.id) return;

            setLoading(true);
            setError(null);
            setAsset(null);
            try {
                // 1. Fetch Auth Session
                const { data: { session } } = await supabase.auth.getSession();
                setIsLoggedIn(!!session);
                if (session?.user?.email) {
                    setIsAdmin(session.user.email === 'id19991016@gmail.com');
                } else {
                    setIsAdmin(false);
                }

                // 2. Fetch Data
                const { data, error } = await supabase
                    .from('assets')
                    .select('*')
                    .eq('id', params.id as string)
                    .single();

                if (error) {
                    throw error;
                }

                if (data) {
                    setAsset(data as AssetDetails);
                }
            } catch (err: unknown) {
                console.warn("Error fetching asset details:", err);
                const isMissing = typeof err === "object" && err !== null && "code" in err && err.code === "PGRST116";
                if (!isMissing) setError("连接素材库时遇到问题，请稍后重试。");
            } finally {
                setLoading(false);
            }
        }

        fetchAssetDetails();
    }, [params?.id, loadAttempt]);

    const handleDownload = () => {
        if (!asset) return;
        const targetUrl = asset.source_file_url || asset.image_url;
        if (targetUrl) {
            const link = document.createElement("a");
            link.href = targetUrl;

            // Try to extract an extension, default to .png if it's falling back to image_url
            let ext = ".png";
            if (asset.source_file_url) {
                const parts = asset.source_file_url.split('.');
                ext = "." + (parts[parts.length - 1] || "zip");
            }

            link.download = `${asset.title || "material_art"}${ext}`;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDelete = async () => {
        if (!isAdmin || !asset) return;

        const confirmed = window.confirm("🚨 警告：您确定要永久删除该科研素材吗？\n\n此操作不可逆，将同时删除数据库记录和云端存储文件！");
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            // 1. Detele from DB
            const { error: dbError } = await supabase
                .from('assets')
                .delete()
                .eq('id', asset.id);

            if (dbError) throw dbError;

            // 2. Try to clean up Storage files (Best Effort)
            try {
                const filesToRemove = [];
                // Extract path from image_url
                if (asset.image_url) {
                    const imgUrlObj = new URL(asset.image_url);
                    const imgPath = imgUrlObj.pathname.split('/materials/')[1];
                    if (imgPath) filesToRemove.push(decodeURIComponent(imgPath));
                }
                // Extract path from source_file_url
                if (asset.source_file_url) {
                    const srcUrlObj = new URL(asset.source_file_url);
                    const srcPath = srcUrlObj.pathname.split('/materials/')[1];
                    if (srcPath) filesToRemove.push(decodeURIComponent(srcPath));
                }

                if (filesToRemove.length > 0) {
                    await supabase.storage.from('materials').remove(filesToRemove);
                }
            } catch (storageErr) {
                console.error("Failed to clean up storage files, but DB record was deleted:", storageErr);
            }

            // 3. Redirect home
            router.push('/');

        } catch (error: unknown) {
            console.error("Delete failed:", error);
            alert(`删除失败: ${error instanceof Error ? error.message : "请稍后重试"}`);
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <main className="asset-detail asset-detail--centered">
                <div className="asset-detail__state-card" role="status" aria-live="polite">
                    <span className="asset-detail__state-icon"><Loader2 size={26} className="asset-detail__spinner" /></span>
                    <span className="asset-detail__eyebrow">MATERIAL ARCHIVE</span>
                    <h1>正在读取素材</h1>
                    <p>高清图像与资料即将呈现</p>
                </div>
            </main>
        );
    }

    if (error || !asset) {
        return (
            <main className="asset-detail asset-detail--centered">
                <div className="asset-detail__state-card">
                    <span className="asset-detail__state-icon"><Box size={30} /></span>
                    <span className="asset-detail__eyebrow">MATERIAL ARCHIVE</span>
                    <h1>{error ? "素材暂时无法加载" : "未找到该素材"}</h1>
                    <p>{error || "该素材可能已被删除或链接无效。"}</p>
                    {error ? (
                        <button className="asset-detail__button asset-detail__button--dark" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                            重新加载素材
                        </button>
                    ) : (
                        <button className="asset-detail__button asset-detail__button--dark" onClick={() => router.push("/")}>
                            <ArrowLeft size={17} /> 返回发现页
                        </button>
                    )}
                </div>
            </main>
        );
    }

    const tagGroups = [
        { title: "应用领域", icon: Zap, tags: asset.tags_application, theme: "peach" },
        { title: "材料体系", icon: Layers, tags: asset.tags_material, theme: "lilac" },
        { title: "演化过程", icon: Activity, tags: asset.tags_process, theme: "rose" },
        { title: "视觉封装", icon: ImageIcon, tags: asset.tags_style, theme: "blue" },
    ].filter(group => group.tags?.length > 0);

    return (
        <main className="asset-detail">
            <div className="asset-detail__shell">
                <div className="asset-detail__topline">
                    <button className="asset-detail__back" onClick={() => router.push("/")}>
                        <ArrowLeft size={17} /> 返回发现页
                    </button>
                    <span className="asset-detail__location"><Box size={15} /> 科研素材库 <span>/</span> 素材档案</span>
                </div>

                <header className="asset-detail__intro">
                    <div>
                        <span className="asset-detail__eyebrow"><span className="asset-detail__eyebrow-dot" /> MATERIAL ARCHIVE <span>/</span> 素材档案</span>
                        <h1>{asset.title}</h1>
                        {asset.description && <p>{asset.description}</p>}
                    </div>
                    <div className="asset-detail__intro-mark" aria-hidden="true"><ImageIcon size={33} strokeWidth={1.4} /></div>
                </header>

                <div className="asset-detail__layout">
                    <section className="asset-detail__preview-card" aria-label="素材图像预览">
                        <div className="asset-detail__card-header">
                            <div><span className="asset-detail__card-kicker">PREVIEW</span><h2>图像预览</h2></div>
                            <span className="asset-detail__format-pill"><ImageIcon size={14} /> 高清图像</span>
                        </div>
                        <div className="asset-detail__image-frame">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={asset.image_url} alt={asset.title} />
                        </div>
                        <div className="asset-detail__image-caption">
                            <span>原图比例展示</span>
                            {asset.created_at && <span><CalendarDays size={14} /> {new Date(asset.created_at).toLocaleDateString("zh-CN")}</span>}
                        </div>
                    </section>

                    <aside className="asset-detail__aside">
                        <section className="asset-detail__action-card">
                            <div className="asset-detail__card-header">
                                <div><span className="asset-detail__card-kicker">RESOURCE</span><h2>获取素材</h2></div>
                                <span className="asset-detail__sparkle" aria-hidden="true" />
                            </div>
                            <p className="asset-detail__action-copy">{asset.source_file_url ? "提供源文件附件，可用于进一步编辑与展示。" : "获取该素材的高清原图。"}</p>
                            {!isLoggedIn ? (
                                <button className="asset-detail__button asset-detail__button--dark" onClick={() => router.push('/login')}>
                                    <LockKeyhole size={18} /> 登录后下载
                                </button>
                            ) : (
                                <button className="asset-detail__button asset-detail__button--dark" onClick={handleDownload}>
                                    <Download size={18} /> {asset.source_file_url ? "下载附件源文件" : "下载高清原图"}
                                </button>
                            )}
                            <p className="asset-detail__usage-note">获准用于学术交流、论文配图及科普展示</p>
                            {isAdmin && (
                                <button className="asset-detail__button asset-detail__button--danger" onClick={handleDelete} disabled={isDeleting}>
                                    {isDeleting ? <Loader2 size={16} className="asset-detail__spinner" /> : <Trash2 size={16} />}
                                    {isDeleting ? "正在删除素材..." : "彻底删除该素材"}
                                </button>
                            )}
                        </section>

                        <section className="asset-detail__tags-card">
                            <div className="asset-detail__card-header">
                                <div><span className="asset-detail__card-kicker">ATTRIBUTES</span><h2>素材属性</h2></div>
                                <span className="asset-detail__count-pill">{tagGroups.length} 组标签</span>
                            </div>
                            {tagGroups.length > 0 ? (
                                <div className="asset-detail__tag-groups">
                                    {tagGroups.map(group => {
                                        const Icon = group.icon;
                                        return (
                                            <div className={`asset-detail__tag-group asset-detail__tag-group--${group.theme}`} key={group.title}>
                                                <h3><Icon size={15} /> {group.title}</h3>
                                                <div>{group.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="asset-detail__no-tags">该素材暂未添加属性标签。</p>}
                        </section>
                    </aside>
                </div>
            </div>
        </main>
    );
}
