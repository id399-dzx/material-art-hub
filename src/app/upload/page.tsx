"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const TAG_CATEGORIES = {
    application: ["锌离子电池", "锂离子电池", "固态电池", "钠离子体系", "液流电池", "电催化", "光催化", "柔性传感器", "纳米医学"],
    material: ["水凝胶", "金属有机框架(MOF)", "共价有机框架(COF)", "钙钛矿", "碳纳米管", "二维材料", "复合材料"],
    process: ["界面修饰", "晶粒取向", "形貌演变", "动态化学", "离子沉积", "电荷转移", "自组装"],
    style: ["C4D源文件", "3D渲染", "微观剖面", "发光质感", "玻璃态", "极简线框"]
};

export default function UploadPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [authChecking, setAuthChecking] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If not logged in, redirect immediately
                window.location.href = "/login";
            } else if (session.user?.email !== 'id19991016@gmail.com') {
                alert("权限不足：仅管理员可以发布素材");
                window.location.href = "/";
            } else {
                setAuthChecking(false);
            }
        };
        checkAuth();
    }, []);

    // Selected Tags
    const [selectedTags, setSelectedTags] = useState<{
        application: string[];
        material: string[];
        process: string[];
        style: string[];
    }>({
        application: [],
        material: [],
        process: [],
        style: []
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleSourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setSourceFile(selectedFile);
        }
    };

    if (authChecking) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                <p className="text-slate-400 font-medium">验证权限中...</p>
            </div>
        );
    }

    const toggleTag = (category: keyof typeof selectedTags, tag: string) => {
        setSelectedTags(prev => {
            const current = prev[category];
            if (current.includes(tag)) {
                return { ...prev, [category]: current.filter(t => t !== tag) };
            } else {
                return { ...prev, [category]: [...current, tag] };
            }
        });
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) {
            setStatus({ type: "error", message: "请提供标题并选择一张图片" });
            return;
        }

        setUploading(true);
        setStatus(null);

        try {
            // 1. Upload image to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('materials')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL for Image
            const { data: { publicUrl } } = supabase.storage
                .from('materials')
                .getPublicUrl(filePath);

            let sourceFilePublicUrl = null;

            // 3. Upload Source File (If provided)
            if (sourceFile) {
                const sourceExt = sourceFile.name.split('.').pop();
                const sourceFileName = `source-${Math.random().toString(36).substring(2)}-${Date.now()}.${sourceExt}`;
                const sourceFilePath = `uploads/source/${sourceFileName}`;

                const { error: sourceUploadError } = await supabase.storage
                    .from('materials')
                    .upload(sourceFilePath, sourceFile);

                if (sourceUploadError) throw sourceUploadError;

                const { data: { publicUrl: sUrl } } = supabase.storage
                    .from('materials')
                    .getPublicUrl(sourceFilePath);
                sourceFilePublicUrl = sUrl;
            }

            // 4. Insert into Database
            const { error: insertError } = await supabase
                .from('assets')
                .insert([
                    {
                        title,
                        description,
                        image_url: publicUrl,
                        source_file_url: sourceFilePublicUrl,
                        tags_application: selectedTags.application,
                        tags_material: selectedTags.material,
                        tags_process: selectedTags.process,
                        tags_style: selectedTags.style,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (insertError) throw insertError;

            setStatus({ type: "success", message: "作品上传成功！正在返回首页..." });

            // Redirect after a short delay
            setTimeout(() => {
                router.push("/");
            }, 2000);

        } catch (error: any) {
            console.error("Upload error details:", error);
            setStatus({ type: "error", message: `上传失败: ${error.message || "未知错误"}` });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors group">
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        <span>返回首页</span>
                    </Link>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        上传科研艺术作品
                    </h1>
                </div>

                <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Image Upload & Preview */}
                    <div className="space-y-6">
                        <div
                            onClick={() => document.getElementById('file-upload')?.click()}
                            className={`relative border-2 border-dashed rounded-3xl p-4 h-80 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-500
                ${previewUrl ? 'border-blue-500/50 bg-slate-900/40' : 'border-slate-800 bg-slate-900/20 hover:border-slate-600 hover:bg-slate-900/30'}`}
                        >
                            <input
                                id="file-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />

                            {previewUrl ? (
                                <>
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white font-medium flex items-center gap-2">
                                            <Upload size={20} /> 更换图片
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
                                        <Upload size={32} />
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium text-white">点击或拖拽图片到此处</p>
                                        <p className="text-sm text-slate-500">支持 JPG, PNG, WEBP (建议比例 4:3 或 16:9)</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">标题 *</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="例如：锌离子电池界面沉积形貌演变"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">描述</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="简要描述作品的科学背景、使用的软件（如C4D）或设计的视觉特征..."
                                    rows={4}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">源文件附件 (可选)</label>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        accept=".zip,.rar,.c4d,.blend,.fbx,.obj"
                                        onChange={handleSourceFileChange}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:transition-colors file:cursor-pointer"
                                    />
                                    {sourceFile && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            <span className="text-xs text-green-400 font-medium max-w-[120px] truncate">{sourceFile.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => setSourceFile(null)}
                                                className="text-slate-500 hover:text-red-400 p-1 rounded-full hover:bg-slate-800 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">支持上传 .c4d / .zip 等工程文件以供下载</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Multi-dimensional Tags */}
                    <div className="space-y-8 bg-slate-900/30 p-6 rounded-3xl border border-slate-800/50 backdrop-blur-sm">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                            多维标签分类
                        </h3>

                        {Object.entries(TAG_CATEGORIES).map(([key, tags]) => (
                            <div key={key} className="space-y-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
                                    {key === 'application' ? '应用领域' :
                                        key === 'material' ? '材料体系' :
                                            key === 'process' ? '物理/化学过程' : '视觉风格'}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleTag(key as keyof typeof selectedTags, tag)}
                                            className={`px-3 py-1.5 text-xs rounded-full border transition-all duration-300
                        ${selectedTags[key as keyof typeof selectedTags].includes(tag)
                                                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Status Message */}
                        {status && (
                            <div className={`p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/50 text-green-400' : 'bg-red-500/10 border border-red-500/50 text-red-400'
                                }`}>
                                {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                                <p className="text-sm font-medium">{status.message}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={uploading}
                            className={`w-full py-4 rounded-2xl font-bold text-white transition-all duration-500 relative overflow-hidden group
                ${uploading ? 'bg-slate-800 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]'}`}
                        >
                            {uploading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <Loader2 className="animate-spin" size={20} />
                                    正在上传到后端服务...
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <Upload size={20} className="group-hover:-translate-y-1 transition-transform" />
                                    确认发布作品
                                </div>
                            )}

                            {/* Shimmer Effect */}
                            {!uploading && (
                                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]" />
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
