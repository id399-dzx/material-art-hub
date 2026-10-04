"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileArchive, ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import { getSupabaseErrorMessage, isSupabaseConnectionError, supabase } from "@/lib/supabase";
import "./upload.css";

const TAG_CATEGORIES = {
    application: ["锌离子电池", "锂离子电池", "固态电池", "钠离子体系", "液流电池", "电催化", "光催化", "柔性传感器", "纳米医学"],
    material: ["水凝胶", "金属有机框架(MOF)", "共价有机框架(COF)", "钙钛矿", "碳纳米管", "二维材料", "复合材料"],
    process: ["界面修饰", "晶粒取向", "形貌演变", "动态化学", "离子沉积", "电荷转移", "自组装"],
    style: ["C4D源文件", "3D渲染", "微观剖面", "发光质感", "玻璃态", "极简线框"]
};

type TagCategory = keyof typeof TAG_CATEGORIES;
type SelectedTags = Record<TagCategory, string[]>;

const CATEGORY_LABELS: Record<TagCategory, string> = {
    application: "应用领域",
    material: "材料体系",
    process: "物理 / 化学过程",
    style: "视觉风格"
};

export default function UploadPage() {
    const router = useRouter();
    const sourceInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [authChecking, setAuthChecking] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authAttempt, setAuthAttempt] = useState(0);
    const [selectedTags, setSelectedTags] = useState<SelectedTags>({
        application: [], material: [], process: [], style: []
    });

    useEffect(() => {
        let mounted = true;
        const checkAuth = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                if (!session) {
                    window.location.replace("/login");
                    return;
                }

                // Confirm the user with Supabase instead of trusting a cached session's email.
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;
                if (!user) {
                    window.location.replace("/login");
                    return;
                }
                if (user.email !== "id19991016@gmail.com") {
                    alert("权限不足：仅管理员可以发布素材");
                    window.location.replace("/");
                    return;
                }

                if (mounted) {
                    setAuthError(null);
                    setAuthChecking(false);
                }
            } catch (error) {
                if (mounted) {
                    setAuthError(isSupabaseConnectionError(error)
                        ? "暂时无法连接账号服务。请稍后重试；管理员请检查 Supabase 项目配置。"
                        : "身份验证失败，请重试或重新登录。");
                    setAuthChecking(false);
                }
            }
        };
        checkAuth();
        return () => { mounted = false; };
    }, [authAttempt]);

    const chooseImage = (selectedFile: File | undefined) => {
        if (!selectedFile) return;
        if (!selectedFile.type.startsWith("image/")) {
            setStatus({ type: "error", message: "请选择 JPG、PNG、WEBP 等图片文件。" });
            return;
        }
        setFile(selectedFile);
        setStatus(null);
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(selectedFile);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        chooseImage(event.target.files?.[0]);
        event.target.value = "";
    };

    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setDragging(false);
        chooseImage(event.dataTransfer.files?.[0]);
    };

    const handleSourceFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSourceFile(event.target.files?.[0] ?? null);
    };

    const clearSourceFile = () => {
        setSourceFile(null);
        if (sourceInputRef.current) sourceInputRef.current.value = "";
    };

    const toggleTag = (category: TagCategory, tag: string) => {
        setSelectedTags((previous) => {
            const current = previous[category];
            return {
                ...previous,
                [category]: current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
            };
        });
    };

    const selectedTagCount = Object.values(selectedTags).reduce((count, tags) => count + tags.length, 0);

    const handleUpload = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!file || !title.trim()) {
            setStatus({ type: "error", message: "请提供标题并选择一张图片。" });
            return;
        }

        setUploading(true);
        setStatus(null);

        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;
            if (user?.email !== "id19991016@gmail.com") {
                throw new Error("当前账号没有发布权限，请重新登录。");
            }

            const fileExt = file.name.split(".").pop();
            const fileName = Math.random().toString(36).substring(2) + "-" + Date.now() + "." + fileExt;
            const filePath = "uploads/" + fileName;

            const { error: uploadError } = await supabase.storage
                .from("materials")
                .upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("materials")
                .getPublicUrl(filePath);

            let sourceFilePublicUrl = null;
            if (sourceFile) {
                const sourceExt = sourceFile.name.split(".").pop();
                const sourceFileName = "source-" + Math.random().toString(36).substring(2) + "-" + Date.now() + "." + sourceExt;
                const sourceFilePath = "uploads/source/" + sourceFileName;

                const { error: sourceUploadError } = await supabase.storage
                    .from("materials")
                    .upload(sourceFilePath, sourceFile);
                if (sourceUploadError) throw sourceUploadError;

                const { data: { publicUrl: sourceUrl } } = supabase.storage
                    .from("materials")
                    .getPublicUrl(sourceFilePath);
                sourceFilePublicUrl = sourceUrl;
            }

            const { error: insertError } = await supabase
                .from("assets")
                .insert([{
                    title: title.trim(),
                    description,
                    image_url: publicUrl,
                    source_file_url: sourceFilePublicUrl,
                    tags_application: selectedTags.application,
                    tags_material: selectedTags.material,
                    tags_process: selectedTags.process,
                    tags_style: selectedTags.style,
                    created_at: new Date().toISOString()
                }]);
            if (insertError) throw insertError;

            setStatus({ type: "success", message: "作品上传成功，正在返回首页…" });
            setTimeout(() => router.push("/"), 2000);
        } catch (error) {
            const message = isSupabaseConnectionError(error)
                ? "素材服务暂时无法连接，请稍后重试；管理员请检查 Supabase 项目配置。"
                : "上传失败：" + (getSupabaseErrorMessage(error) ?? "未知错误");
            setStatus({ type: "error", message });
        } finally {
            setUploading(false);
        }
    };

    if (authChecking) {
        return (
            <main className="asset-upload-workbench asset-upload-loading">
                <div className="asset-upload-loading-card" role="status">
                    <Loader2 size={24} className="asset-upload-spin" />
                    <span>验证发布权限中…</span>
                </div>
            </main>
        );
    }

    if (authError) {
        return (
            <main className="asset-upload-workbench asset-upload-loading">
                <div className="asset-upload-loading-card flex-col text-center" role="alert">
                    <AlertCircle size={25} />
                    <span>{authError}</span>
                    <button type="button" className="asset-upload-back" onClick={() => {
                        setAuthError(null);
                        setAuthChecking(true);
                        setAuthAttempt((attempt) => attempt + 1);
                    }}>重试连接</button>
                </div>
            </main>
        );
    }

    return (
        <main className="asset-upload-workbench">
            <div className="asset-upload-shell">
                <div className="flex items-center justify-between gap-4 flex-wrap"><Link href="/" className="asset-upload-back"><ArrowLeft size={17} /> 返回首页</Link><Link href="/software-plugins#publish" className="asset-upload-back"><FileArchive size={17} /> 发布软件插件 <ArrowRight size={15} /></Link></div>
                <header className="asset-upload-heading">
                    <div>
                        <span className="asset-upload-eyebrow"><span /> FESILENT REVERIE / PUBLISH</span>
                        <h1>上传科研艺术作品</h1>
                        <p>整理预览图、作品信息和分类标签，让研究成果更易被发现。</p>
                    </div>
                    <div className="asset-upload-heading-mark" aria-hidden="true"><Sparkles size={28} /></div>
                </header>

                <form onSubmit={handleUpload} className="asset-upload-layout">
                    <div className="asset-upload-main">
                        <section className="asset-upload-card">
                            <div className="asset-upload-card-header">
                                <div><span className="asset-upload-step">01 / 预览图片</span><h2>展示你的作品</h2></div>
                                <span className="asset-upload-required">必填</span>
                            </div>
                            <label
                                htmlFor="asset-image-input"
                                className={"asset-upload-dropzone" + (dragging ? " is-dragging" : "") + (previewUrl ? " has-preview" : "")}
                                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                                onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
                                onDrop={handleDrop}
                            >
                                <input id="asset-image-input" type="file" accept="image/*" onChange={handleFileChange} />
                                {previewUrl ? (
                                    <>
                                        {/* A local FileReader data URL is used for the immediate upload preview. */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={previewUrl} alt={title ? title + "预览" : "待上传图片预览"} />
                                        <span className="asset-upload-replace"><ImagePlus size={18} /> 点击更换图片</span>
                                    </>
                                ) : (
                                    <span className="asset-upload-drop-content">
                                        <span className="asset-upload-drop-icon"><ImagePlus size={28} strokeWidth={1.8} /></span>
                                        <strong>将图片拖到这里，或点击选择文件</strong>
                                        <span>支持 JPG、PNG、WEBP 等图片格式</span>
                                    </span>
                                )}
                            </label>
                            <p className="asset-upload-help">{file ? "已选择：" + file.name : "建议使用 4:3 或 16:9 比例的清晰预览图。"}</p>
                        </section>

                        <section className="asset-upload-card">
                            <div className="asset-upload-card-header">
                                <div><span className="asset-upload-step">02 / 作品信息</span><h2>补充内容说明</h2></div>
                            </div>
                            <div className="asset-upload-fields">
                                <div className="asset-upload-field">
                                    <label htmlFor="asset-title">作品标题 <span>*</span></label>
                                    <input id="asset-title" type="text" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：锌离子电池界面沉积形貌演变" />
                                </div>
                                <div className="asset-upload-field">
                                    <label htmlFor="asset-description">作品描述</label>
                                    <textarea id="asset-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="简要描述科学背景、使用的软件或作品的视觉特征…" rows={4} />
                                </div>
                                <div className="asset-upload-field">
                                    <label htmlFor="asset-source-file">源文件附件 <span className="asset-upload-optional">可选</span></label>
                                    <div className="asset-upload-source">
                                        <FileArchive size={19} aria-hidden="true" />
                                        <input ref={sourceInputRef} id="asset-source-file" type="file" accept=".zip,.rar,.c4d,.blend,.fbx,.obj" onChange={handleSourceFileChange} />
                                        {sourceFile && <button type="button" onClick={clearSourceFile} aria-label="移除源文件"><X size={16} /></button>}
                                    </div>
                                    <p className="asset-upload-help">可添加 .c4d、.blend、.zip 等工程文件供下载。</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    <aside className="asset-upload-card asset-upload-tags-card">
                        <div className="asset-upload-card-header">
                            <div><span className="asset-upload-step">03 / 分类标签</span><h2>让作品更易检索</h2></div>
                            <span className="asset-upload-tag-count">{selectedTagCount} 已选</span>
                        </div>
                        <p className="asset-upload-tags-intro">根据作品内容选择合适的标签，可多选。</p>
                        <div className="asset-upload-tag-groups">
                            {(Object.entries(TAG_CATEGORIES) as [TagCategory, string[]][]).map(([category, tags]) => (
                                <div className="asset-upload-tag-group" key={category}>
                                    <h3>{CATEGORY_LABELS[category]}</h3>
                                    <div className="asset-upload-tag-list">
                                        {tags.map((tag) => {
                                            const selected = selectedTags[category].includes(tag);
                                            return <button type="button" key={tag} className={"asset-upload-tag" + (selected ? " is-selected" : "")} onClick={() => toggleTag(category, tag)} aria-pressed={selected}>{tag}</button>;
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {status && <div className={"asset-upload-status asset-upload-status--" + status.type} role={status.type === "error" ? "alert" : "status"}>{status.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<span>{status.message}</span></div>}

                        <button type="submit" className="asset-upload-submit" disabled={uploading}>{uploading ? <><Loader2 size={18} className="asset-upload-spin" /> 正在上传…</> : <><Upload size={18} /> 确认发布作品 <ArrowRight size={17} /></>}</button>
                    </aside>
                </form>
            </div>
        </main>
    );
}
