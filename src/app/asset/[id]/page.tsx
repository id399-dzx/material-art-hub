"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Download, Image as ImageIcon, Box, Layers, Zap, Activity, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";

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
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        async function fetchAssetDetails() {
            if (!params?.id) return;

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
            } catch (err: any) {
                console.error("Error fetching asset details:", err);
                setError(err.message || "无法加载素材数据");
            } finally {
                setLoading(false);
            }
        }

        fetchAssetDetails();
    }, [params?.id]);

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

        } catch (error: any) {
            console.error("Delete failed:", error);
            alert(`删除失败: ${error.message}`);
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="text-slate-400 font-medium tracking-wider animate-pulse">加载高清素材中...</p>
            </div>
        );
    }

    if (error || !asset) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
                <Box size={64} className="text-slate-700 opacity-50" />
                <h2 className="text-2xl font-bold text-slate-300">未找到该素材</h2>
                <p className="text-slate-500">{error || "该素材可能已被删除或链接无效。"}</p>
                <button
                    onClick={() => router.push("/")}
                    className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]"
                >
                    返回首页
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
            {/* Navigation Bar */}
            <div className="bg-transparent border-b border-slate-800/60 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group px-2 py-1 -ml-2 rounded-lg hover:bg-slate-800/50"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">返回发现页</span>
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold tracking-widest text-slate-500 uppercase">
                        <Box size={16} className="text-blue-500" />
                        MaterialArt Details
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                    {/* Left Column: HD Image Viewer */}
                    <div className="lg:col-span-8 flex flex-col space-y-6">
                        <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] group h-[60vh] lg:h-[80vh]">
                            {/* Inner Glow */}
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none z-10" />

                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={asset.image_url}
                                alt={asset.title}
                                className="w-full h-full object-contain bg-black/40 backdrop-blur-sm transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                            />
                        </div>
                    </div>

                    {/* Right Column: Details & Actions */}
                    <div className="lg:col-span-4 flex flex-col space-y-10 lg:sticky lg:top-28">

                        <div className="space-y-6">
                            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight drop-shadow-lg">
                                {asset.title}
                            </h1>

                            {asset.description && (
                                <div className="prose prose-invert prose-slate">
                                    <p className="text-slate-400 text-lg leading-relaxed font-light">
                                        {asset.description}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Call to Action */}
                        <div className="pt-2 pb-6 border-b border-slate-800/60 flex flex-col gap-4">
                            {!isLoggedIn ? (
                                <button
                                    onClick={() => router.push('/login')}
                                    className="w-full py-4 px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-inner"
                                >
                                    🔒 登录后下载
                                </button>
                            ) : (
                                <button
                                    onClick={handleDownload}
                                    className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] hover:-translate-y-1 group"
                                >
                                    <Download size={22} className="group-hover:animate-bounce" />
                                    {asset.source_file_url ? "获取附件源文件 (C4D/ZIP)" : "获取高清原图 (Image)"}
                                </button>
                            )}

                            {isAdmin && (
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className={`w-full py-3 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 border
                                        ${isDeleting
                                            ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed'
                                            : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                                        }
                                    `}
                                >
                                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    {isDeleting ? "正在粉碎数据..." : "危险操作：彻底删除该素材"}
                                </button>
                            )}

                            <p className="text-center text-xs text-slate-500 mt-2 font-medium tracking-wide">
                                获准用于学术交流、论文配图及科普展示
                            </p>
                        </div>

                        {/* Tag Categories */}
                        <div className="space-y-8 pt-4">
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                多维属性解析
                            </h3>

                            <div className="grid grid-cols-1 gap-6">
                                {/* Application Tags */}
                                {asset.tags_application?.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-yellow-500/80 uppercase">
                                            <Zap size={14} /> 应用领域
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {asset.tags_application.map(tag => (
                                                <span key={tag} className="px-3 py-1.5 text-xs font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Material Tags */}
                                {asset.tags_material?.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-purple-500/80 uppercase">
                                            <Layers size={14} /> 材料体系
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {asset.tags_material.map(tag => (
                                                <span key={tag} className="px-3 py-1.5 text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Process Tags */}
                                {asset.tags_process?.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-red-500/80 uppercase">
                                            <Activity size={14} /> 演化过程
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {asset.tags_process.map(tag => (
                                                <span key={tag} className="px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Style Tags */}
                                {asset.tags_style?.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-green-500/80 uppercase">
                                            <ImageIcon size={14} /> 视觉封装
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {asset.tags_style.map(tag => (
                                                <span key={tag} className="px-3 py-1.5 text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
