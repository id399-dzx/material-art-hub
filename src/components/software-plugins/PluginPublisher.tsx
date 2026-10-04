'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, FileArchive, ImagePlus, Loader2, UploadCloud, X } from 'lucide-react';
import type { SoftwareHost } from '@/lib/software-plugins/catalog';
import { publishSoftwarePlugin, type PluginPublicationInput } from '@/lib/software-plugins/storage';
import { getSupabaseErrorMessage, isSupabaseConnectionError } from '@/lib/supabase';
import './plugin-publisher.css';

type Props = { onPublished: () => void; onBusyChange?: (busy: boolean) => void };
type DetailsField = 'features' | 'environment' | 'installation' | 'outputs';
const detailFields: { key: DetailsField; label: string; hint: string; placeholder: string }[] = [
    { key: 'features', label: '主要功能', hint: '告诉用户它能完成什么', placeholder: '批量整理科研图片\n自动添加子图编号\n导出可编辑图形' },
    { key: 'environment', label: '运行环境', hint: '软件版本、系统与必要依赖', placeholder: 'Windows 10 / 11\nPowerPoint 2021 或更新版本' },
    { key: 'installation', label: '安装与使用', hint: '按操作顺序填写', placeholder: '下载并解压安装包\n按照包内 README 完成安装\n打开软件后使用插件' },
    { key: 'outputs', label: '输出内容', hint: '支持导出或生成哪些文件', placeholder: '可编辑项目文件\nPNG 预览图\nSVG 矢量图' },
];
const lines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
function fileSize(bytes: number) { return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB'; }

export default function PluginPublisher({ onPublished, onBusyChange }: Props) {
    const id = useId();
    const [name, setName] = useState('');
    const [host, setHost] = useState<SoftwareHost | ''>('');
    const [summary, setSummary] = useState('');
    const [version, setVersion] = useState('');
    const [details, setDetails] = useState<Record<DetailsField, string>>({ features: '', environment: '', installation: '', outputs: '' });
    const [packageFile, setPackageFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [published, setPublished] = useState(false);
    const packageRef = useRef<HTMLInputElement>(null);
    const coverRef = useRef<HTMLInputElement>(null);
    const previewUrl = useRef('');
    const submitting = useRef(false);

    useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

    function selectPackage(event: ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        if (!/\.zip$/i.test(file.name) || !file.size || file.size > 50 * 1024 * 1024) {
            setError('请选择非空的 ZIP 安装包，大小不超过 50 MB。');
            event.currentTarget.value = '';
            return;
        }
        setPackageFile(file); setError(''); setPublished(false);
    }
    function selectCover(event: ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        if (!/\.(png|jpe?g|webp)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) {
            setError('封面支持 PNG、JPEG 或 WEBP，大小不超过 5 MB。');
            event.currentTarget.value = '';
            return;
        }
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = URL.createObjectURL(file);
        setCoverPreview(previewUrl.current); setCoverFile(file); setError(''); setPublished(false);
    }
    function removeCover() {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = ''; setCoverPreview(''); setCoverFile(null);
        if (coverRef.current) coverRef.current.value = '';
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current || published) return;
        if (!name.trim() || !host || !summary.trim() || !version.trim() || !packageFile) {
            setError('请填写插件名称、适用软件、中文简介和版本，并选择 ZIP 安装包。');
            if (!packageFile) packageRef.current?.focus();
            return;
        }
        submitting.current = true; setBusy(true); onBusyChange?.(true); setError('');
        const input: PluginPublicationInput = {
            name: name.trim(), host, summary: summary.trim(), version: version.trim(),
            features: lines(details.features), environment: lines(details.environment),
            installation: lines(details.installation), outputs: lines(details.outputs),
            packageFile, ...(coverFile ? { coverFile } : {}),
        };
        try {
            await publishSoftwarePlugin(input);
            setPublished(true);
            onPublished();
        } catch (error) { setError(isSupabaseConnectionError(error) ? '暂时无法连接上传服务，已保留填写内容，请稍后重试。' : (getSupabaseErrorMessage(error) ?? '上传发布失败，已保留填写内容，请重试。')); }
        finally { submitting.current = false; setBusy(false); onBusyChange?.(false); }
    }

    return <form className="plugin-publisher" onSubmit={submit} aria-label="发布自己的软件插件">
        <p className="plugin-publisher-intro">填写中文介绍并选择安装包，发布后会以插件卡片展示。文件在点击发布前仅保留在本机。</p>
        <fieldset disabled={busy || published}>
            <legend className="plugin-publisher-section"><span>01</span>插件信息</legend>
            <div className="plugin-publisher-fields">
                <label className="plugin-publisher-field" htmlFor={id + '-name'}><span>插件名称 <i>必填</i></span><input id={id + '-name'} name="name" value={name} onChange={event => setName(event.currentTarget.value)} maxLength={120} required placeholder="例如：科研图片排版工具" autoComplete="off" /></label>
                <label className="plugin-publisher-field" htmlFor={id + '-host'}><span>适用软件 <i>必填</i></span><select id={id + '-host'} name="host" value={host} onChange={event => setHost(event.currentTarget.value as SoftwareHost)} required><option value="" disabled>选择适用软件</option><option value="Blender">Blender</option><option value="PowerPoint">PowerPoint / PPT</option><option value="Illustrator">Illustrator</option><option value="其他">其他软件</option></select></label>
                <label className="plugin-publisher-field" htmlFor={id + '-version'}><span>发布版本 <i>必填</i></span><input id={id + '-version'} name="version" value={version} onChange={event => setVersion(event.currentTarget.value)} maxLength={64} required placeholder="例如：1.0.0" autoComplete="off" /></label>
                <div className="plugin-publisher-version-note">填写与安装包一致的版本，方便用户确认下载内容。</div>
                <label className="plugin-publisher-field plugin-publisher-full" htmlFor={id + '-summary'}><span>中文简介 <i>必填</i></span><textarea id={id + '-summary'} name="summary" value={summary} onChange={event => setSummary(event.currentTarget.value)} maxLength={2000} required rows={3} placeholder="说明插件解决什么问题、适合哪些科研工作，以及使用方式。" /><small>该介绍会显示在插件卡片与详情中。</small></label>
            </div>
        </fieldset>

        <fieldset disabled={busy || published}>
            <legend className="plugin-publisher-section"><span>02</span>安装包与封面</legend>
            <div className="plugin-publisher-files">
                <label className={'plugin-publisher-upload ' + (packageFile ? 'has-file' : '')} htmlFor={id + '-package'}>
                    <input ref={packageRef} id={id + '-package'} type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={selectPackage} aria-required="true" aria-describedby={id + '-package-hint'} />
                    <span className="plugin-publisher-upload-icon">{packageFile ? <FileArchive size={24} /> : <UploadCloud size={24} />}</span>
                    <strong>{packageFile ? packageFile.name : '选择 ZIP 安装包'}</strong>
                    <span id={id + '-package-hint'}>{packageFile ? fileSize(packageFile.size) + ' · 点击可更换' : '必填 · 最大 50 MB'}</span>
                </label>
                <div className="plugin-publisher-cover">
                    <label className={'plugin-publisher-upload ' + (coverFile ? 'has-file has-cover' : '')} htmlFor={id + '-cover'}>
                        <input ref={coverRef} id={id + '-cover'} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={selectCover} aria-describedby={id + '-cover-hint'} />
                        {coverPreview ? <>
                            {/* The preview stays local until the explicit publish action. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={coverPreview} alt="所选插件封面预览" />
                        </> : <span className="plugin-publisher-upload-icon"><ImagePlus size={24} /></span>}
                        <strong>{coverFile ? coverFile.name : '选择插件封面'}</strong>
                        <span id={id + '-cover-hint'}>{coverFile ? fileSize(coverFile.size) + ' · 点击可更换' : '选填 · PNG / JPEG / WEBP · 最大 5 MB'}</span>
                    </label>
                    {coverFile && <button type="button" className="plugin-publisher-remove-cover" onClick={removeCover}><X size={12} />移除封面</button>}
                </div>
            </div>
        </fieldset>

        <fieldset disabled={busy || published}>
            <legend className="plugin-publisher-section"><span>03</span>使用说明 <small>选填，每行一条</small></legend>
            <div className="plugin-publisher-fields">{detailFields.map(field => <label key={field.key} className="plugin-publisher-field" htmlFor={id + '-' + field.key}><span>{field.label}</span><textarea id={id + '-' + field.key} name={field.key} value={details[field.key]} onChange={event => { const value = event.currentTarget.value; setDetails(current => ({ ...current, [field.key]: value })); }} rows={3} maxLength={6000} placeholder={field.placeholder} /><small>{field.hint}</small></label>)}</div>
        </fieldset>

        <div className="plugin-publisher-publication">
            <div><strong>发布后访客可以查看介绍并下载安装包。</strong><p>点击“上传并发布插件”将公开填写的介绍、所选 ZIP 和封面。仅选择文件不会上传或公开你的本地项目。</p></div>
            <button type="submit" disabled={busy || published}>{busy ? <Loader2 size={16} className="animate-spin" /> : published ? <CheckCircle2 size={16} /> : <UploadCloud size={16} />}{busy ? '正在上传并发布…' : published ? '插件已发布' : '上传并发布插件'}</button>
        </div>
        {busy && <p className="plugin-publisher-status" role="status">正在上传所选文件并保存插件介绍，请保持此页面打开。</p>}
        {error && <p className="plugin-publisher-error" role="alert">{error}</p>}
        {published && <p className="plugin-publisher-success" role="status"><CheckCircle2 size={15} />发布成功，插件已加入软件插件列表。</p>}
    </form>;
}
