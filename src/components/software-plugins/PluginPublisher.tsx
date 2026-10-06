'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, FileArchive, ImagePlus, Loader2, UploadCloud, X } from 'lucide-react';
import { PLUGIN_PACKAGE_MAX_BYTES, type SoftwareHost, type SoftwarePlugin } from '@/lib/software-plugins/catalog';
import { checkPluginPublicationStorage, publishSoftwarePlugin, type PluginPublicationInput, type PluginPublicationStage } from '@/lib/software-plugins/storage';
import { getSupabaseErrorMessage, isSupabaseConnectionError } from '@/lib/supabase';
import './plugin-publisher.css';

type Props = { plugin?: SoftwarePlugin; onPublished: () => void; onBusyChange?: (busy: boolean) => void };
type DetailsField = 'features' | 'environment' | 'installation' | 'outputs';
type IssueField = 'name' | 'host' | 'summary' | 'version' | 'packageFile' | 'coverFile' | DetailsField;
const fieldLabels: Record<IssueField, string> = { name: '插件名称', host: '适用软件', summary: '中文简介', version: '发布版本', packageFile: 'ZIP 安装包', coverFile: '插件封面', features: '主要功能', environment: '运行环境', installation: '安装与使用', outputs: '输出内容' };
const detailFields: { key: DetailsField; label: string; hint: string; placeholder: string }[] = [
    { key: 'features', label: '主要功能', hint: '告诉用户它能完成什么', placeholder: '批量整理科研图片\n自动添加子图编号\n导出可编辑图形' },
    { key: 'environment', label: '运行环境', hint: '软件版本、系统与必要依赖', placeholder: 'Windows 10 / 11\nPowerPoint 2021 或更新版本' },
    { key: 'installation', label: '安装与使用', hint: '按操作顺序填写', placeholder: '下载并解压安装包\n按照包内 README 完成安装\n打开软件后使用插件' },
    { key: 'outputs', label: '输出内容', hint: '支持导出或生成哪些文件', placeholder: '可编辑项目文件\nPNG 预览图\nSVG 矢量图' },
];
const lines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
function fileSize(bytes: number) { return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB'; }

export default function PluginPublisher({ plugin, onPublished, onBusyChange }: Props) {
    const id = useId();
    const isEditing = Boolean(plugin);
    const action = isEditing ? '更新' : '发布';
    const stageLabels: Record<PluginPublicationStage, string> = { checking: '核验账号与文件', package: isEditing ? '上传新版 ZIP' : '上传私有 ZIP', cover: '上传公开封面', publishing: action + '插件介绍' };
    const [name, setName] = useState(plugin?.name ?? '');
    const [host, setHost] = useState<SoftwareHost | ''>(plugin?.host ?? '');
    const [summary, setSummary] = useState(plugin?.summary ?? '');
    const [version, setVersion] = useState(plugin?.version ?? '');
    const [details, setDetails] = useState<Record<DetailsField, string>>({ features: plugin?.features.join('\n') ?? '', environment: plugin?.environment.join('\n') ?? '', installation: plugin?.installation.join('\n') ?? '', outputs: plugin?.outputs.join('\n') ?? '' });
    const [packageFile, setPackageFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState(plugin?.coverUrl ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [invalidFields, setInvalidFields] = useState<IssueField[]>([]);
    const [errorRevision, setErrorRevision] = useState(0);
    const [stage, setStage] = useState<PluginPublicationStage>('checking');
    const [started, setStarted] = useState(false);
    const [serviceState, setServiceState] = useState<'checking' | 'ready' | 'failed'>('checking');
    const [serviceError, setServiceError] = useState('');
    const [serviceRetry, setServiceRetry] = useState(0);
    const [published, setPublished] = useState(false);
    const [packageProgress, setPackageProgress] = useState({ completed: 0, total: 0 });
    const packageRef = useRef<HTMLInputElement>(null);
    const coverRef = useRef<HTMLInputElement>(null);
    const previewUrl = useRef('');
    const submitting = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    const feedbackRef = useRef<HTMLDivElement>(null);
    const serviceSequence = useRef(0);

    useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
    useEffect(() => {
        setName(plugin?.name ?? ''); setHost(plugin?.host ?? ''); setSummary(plugin?.summary ?? ''); setVersion(plugin?.version ?? '');
        setDetails({ features: plugin?.features.join('\n') ?? '', environment: plugin?.environment.join('\n') ?? '', installation: plugin?.installation.join('\n') ?? '', outputs: plugin?.outputs.join('\n') ?? '' });
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = ''; setCoverPreview(plugin?.coverUrl ?? ''); setCoverFile(null); setPackageFile(null);
        if (packageRef.current) packageRef.current.value = '';
        if (coverRef.current) coverRef.current.value = '';
        setError(''); setInvalidFields([]); setPublished(false); setStarted(false); setStage('checking'); setPackageProgress({ completed: 0, total: 0 });
    }, [plugin]);
    useEffect(() => {
        let cancelled = false;
        const sequence = ++serviceSequence.current;
        setServiceState('checking'); setServiceError('');
        void checkPluginPublicationStorage().then(() => {
            if (!cancelled && sequence === serviceSequence.current) setServiceState('ready');
        }).catch(error => {
            if (cancelled || sequence !== serviceSequence.current) return;
            setServiceState('failed');
            setServiceError(getSupabaseErrorMessage(error) ?? '无法检查上传服务，请重试。');
        });
        return () => { cancelled = true; };
    }, [serviceRetry]);
    useEffect(() => {
        if (!error && !serviceError) return;
        const frame = requestAnimationFrame(() => {
            feedbackRef.current?.focus({ preventScroll: true });
            feedbackRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        });
        return () => cancelAnimationFrame(frame);
    }, [error, serviceError, errorRevision]);

    function showError(message: string, fields: IssueField[] = []) {
        setError(message); setInvalidFields(fields); setErrorRevision(value => value + 1);
    }
    function clearFieldError(field: IssueField) {
        if (!invalidFields.includes(field)) return;
        const next = invalidFields.filter(item => item !== field);
        setInvalidFields(next);
        if (!next.length) setError('');
    }
    function focusField(field: IssueField) {
        const input = formRef.current?.querySelector<HTMLElement>('[name="' + field + '"]');
        input?.scrollIntoView({ behavior: 'auto', block: 'center' });
        input?.focus({ preventScroll: true });
    }
    function fieldAria(field: IssueField) {
        const invalid = invalidFields.includes(field);
        return { 'aria-invalid': invalid, 'aria-describedby': invalid ? id + '-feedback' : undefined };
    }

    function selectPackage(event: ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        if (!/\.zip$/i.test(file.name) || !file.size || file.size > PLUGIN_PACKAGE_MAX_BYTES) {
            setPackageFile(null); setStarted(false); showError(`请选择非空的 ZIP 安装包，大小不超过 ${PLUGIN_PACKAGE_MAX_BYTES / 1024 / 1024} MB。`, ['packageFile']);
            event.currentTarget.value = '';
            return;
        }
        setPackageFile(file); setError(''); setInvalidFields([]); setPublished(false);
    }
    function selectCover(event: ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        if (!/\.(png|jpe?g|webp)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) {
            removeCover(); setStarted(false); showError('封面支持 PNG、JPEG 或 WEBP，大小不超过 5 MB。', ['coverFile']);
            event.currentTarget.value = '';
            return;
        }
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = URL.createObjectURL(file);
        setCoverPreview(previewUrl.current); setCoverFile(file); setError(''); setInvalidFields([]); setPublished(false);
    }
    function removeCover() {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = ''; setCoverPreview(plugin?.coverUrl ?? ''); setCoverFile(null);
        if (coverRef.current) coverRef.current.value = '';
        clearFieldError('coverFile');
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current || published) return;
        if (serviceState !== 'ready') { showError(serviceState === 'checking' ? `正在检查上传服务，请稍后再${action}。` : '上传服务尚未就绪，请先重试服务检查。'); return; }
        setStarted(false);
        const missing: IssueField[] = [];
        if (!name.trim()) missing.push('name');
        if (!host) missing.push('host');
        if (!summary.trim()) missing.push('summary');
        if (!version.trim()) missing.push('version');
        if (!packageFile) missing.push('packageFile');
        if (missing.length) {
            showError(`请先补全以下必填项，再上传${action}。`, missing);
            return;
        }
        const invalidLists = detailFields.filter(field => lines(details[field.key]).length > 40 || lines(details[field.key]).some(line => line.length > 1000)).map(field => field.key);
        if (invalidLists.length) { showError('使用说明每项最多 40 条，每条不超过 1000 字，请缩短后重试。', invalidLists); return; }
        // File and host are narrowed by the explicit validation above.
        if (!packageFile || !host) return;
        submitting.current = true; setBusy(true); onBusyChange?.(true); setError(''); setInvalidFields([]); setStage('checking'); setStarted(true); setPackageProgress({ completed: 0, total: 0 });
        const input: PluginPublicationInput = {
            name: name.trim(), host, summary: summary.trim(), version: version.trim(),
            features: lines(details.features), environment: lines(details.environment),
            installation: lines(details.installation), outputs: lines(details.outputs),
            packageFile, ...(coverFile ? { coverFile } : {}), ...(plugin ? { existingPlugin: plugin } : {}),
        };
        try {
            await publishSoftwarePlugin(input, setStage, setPackageProgress);
            setPublished(true);
        } catch (error) { showError(isSupabaseConnectionError(error) ? '暂时无法连接上传服务，已保留填写内容，请稍后重试。' : (getSupabaseErrorMessage(error) ?? `上传${action}失败，已保留填写内容，请重试。`)); return; }
        finally { submitting.current = false; setBusy(false); onBusyChange?.(false); }
        onPublished();
    }

    const stages: PluginPublicationStage[] = coverFile ? ['checking', 'package', 'cover', 'publishing'] : ['checking', 'package', 'publishing'];
    const feedbackError = error || serviceError;
    return <form ref={formRef} className="plugin-publisher" onSubmit={submit} noValidate aria-label={isEditing ? '更新软件插件' : '发布自己的软件插件'} aria-busy={busy}>
        <p className="plugin-publisher-intro">介绍与封面公开展示，ZIP 安装包存入私有空间，用户登录后才能下载。点击{action}前，所选文件仅保留在本机。</p>
        {(busy || feedbackError || published || serviceState !== 'ready') && <div id={id + '-feedback'} ref={feedbackRef} tabIndex={-1} className={'plugin-publisher-feedback ' + (feedbackError ? 'is-error' : published ? 'is-success' : 'is-busy')} role={feedbackError ? 'alert' : 'status'} aria-live={feedbackError ? 'assertive' : 'polite'}>
            {feedbackError ? <><strong>{started ? action + '未完成 · ' + stageLabels[stage] : error ? '请检查填写内容' : '上传服务尚未就绪'}</strong><p>{feedbackError}</p>{error && serviceError && <p>{serviceError}</p>}{invalidFields.length > 0 && <div className="plugin-publisher-error-fields" aria-label="需要修改的字段">{invalidFields.map(field => <button key={field} type="button" onClick={() => focusField(field)}>{fieldLabels[field]}</button>)}</div>}{serviceState === 'failed' && <button className="plugin-publisher-service-retry" type="button" disabled={busy} onClick={() => { setError(''); setInvalidFields([]); setStarted(false); setServiceState('checking'); setServiceError(''); setServiceRetry(value => value + 1); }}>重试上传服务检查</button>}<small>填写内容已保留，修正后可再次{action}。</small></>
                : published ? <><strong><CheckCircle2 size={16} />插件已{action}</strong><p>{isEditing ? '插件介绍与安装包已更新，安装包仅登录后可下载。' : '介绍与封面已加入插件列表，安装包仅登录后可下载。'}</p></>
                    : busy ? <><strong><Loader2 size={16} className="animate-spin" />{stageLabels[stage]}…</strong><ol className="plugin-publisher-stages">{stages.map((item, index) => <li key={item} className={item === stage ? 'is-current' : index < stages.indexOf(stage) ? 'is-complete' : ''}><span>{index < stages.indexOf(stage) ? <CheckCircle2 size={12} /> : index + 1}</span>{stageLabels[item]}</li>)}</ol>{stage === 'package' && packageProgress.total > 1 && <p>已完成 {packageProgress.completed} / {packageProgress.total} 部分，正在上传完整安装包。</p>}<small>请保持此页面打开。上传耗时取决于安装包大小与网络。</small></>
                        : <><strong><Loader2 size={16} className="animate-spin" />正在检查上传服务…</strong><p>正在确认管理员权限与私有安装包空间。你可以继续填写介绍、选择本机文件。</p></>}
        </div>}
        <fieldset disabled={busy || published}>
            <legend className="plugin-publisher-section"><span>01</span>插件信息</legend>
            <div className="plugin-publisher-fields">
                <label className="plugin-publisher-field" htmlFor={id + '-name'}><span>插件名称 <i>必填</i></span><input id={id + '-name'} name="name" value={name} onChange={event => { setName(event.currentTarget.value); clearFieldError('name'); }} {...fieldAria('name')} maxLength={120} required placeholder="例如：科研图片排版工具" autoComplete="off" /></label>
                <label className="plugin-publisher-field" htmlFor={id + '-host'}><span>适用软件 <i>必填</i></span><select id={id + '-host'} name="host" value={host} onChange={event => { setHost(event.currentTarget.value as SoftwareHost); clearFieldError('host'); }} {...fieldAria('host')} required><option value="" disabled>选择适用软件</option><option value="Blender">Blender</option><option value="C4D">Cinema 4D / C4D</option><option value="PowerPoint">PowerPoint / PPT</option><option value="Illustrator">Illustrator</option><option value="其他">其他软件</option></select></label>
                <label className="plugin-publisher-field" htmlFor={id + '-version'}><span>发布版本 <i>必填</i></span><input id={id + '-version'} name="version" value={version} onChange={event => { setVersion(event.currentTarget.value); clearFieldError('version'); }} {...fieldAria('version')} maxLength={64} required placeholder="例如：1.0.0" autoComplete="off" /></label>
                <div className="plugin-publisher-version-note">填写与安装包一致的版本，方便用户确认下载内容。</div>
                <label className="plugin-publisher-field plugin-publisher-full" htmlFor={id + '-summary'}><span>中文简介 <i>必填</i></span><textarea id={id + '-summary'} name="summary" value={summary} onChange={event => { setSummary(event.currentTarget.value); clearFieldError('summary'); }} {...fieldAria('summary')} maxLength={2000} required rows={3} placeholder="说明插件解决什么问题、适合哪些科研工作，以及使用方式。" /><small>该介绍会公开显示在插件卡片与详情中。</small></label>
            </div>
        </fieldset>

        <fieldset disabled={busy || published}>
            <legend className="plugin-publisher-section"><span>02</span>安装包与封面</legend>
            <div className="plugin-publisher-files">
                <label className={'plugin-publisher-upload ' + (packageFile ? 'has-file' : '')} htmlFor={id + '-package'}>
                    <input ref={packageRef} id={id + '-package'} name="packageFile" type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={selectPackage} aria-required="true" aria-invalid={invalidFields.includes('packageFile')} aria-describedby={(invalidFields.includes('packageFile') ? id + '-feedback ' : '') + id + '-package-hint' + (plugin ? ' ' + id + '-package-current' : '')} />
                    <span className="plugin-publisher-upload-icon">{packageFile ? <FileArchive size={24} /> : <UploadCloud size={24} />}</span>
                    <strong>{packageFile ? packageFile.name : isEditing ? '选择新版 ZIP 安装包' : '选择 ZIP 安装包'}</strong>
                    <span id={id + '-package-hint'}>{packageFile ? fileSize(packageFile.size) + ' · 点击可更换' : `必填 · 私有存储 · 最大 ${PLUGIN_PACKAGE_MAX_BYTES / 1024 / 1024} MB`}</span>
                    {plugin && <span id={id + '-package-current'}>当前安装包：{plugin.packageName} · 更新需选择新 ZIP</span>}
                </label>
                <div className="plugin-publisher-cover">
                    <label className={'plugin-publisher-upload ' + (coverPreview ? 'has-file has-cover' : '')} htmlFor={id + '-cover'}>
                        <input ref={coverRef} id={id + '-cover'} name="coverFile" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={selectCover} aria-invalid={invalidFields.includes('coverFile')} aria-describedby={(invalidFields.includes('coverFile') ? id + '-feedback ' : '') + id + '-cover-hint'} />
                        {coverPreview ? <>
                            {/* Newly selected files stay local until the explicit publication action. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={coverPreview} alt={coverFile ? '所选插件封面预览' : '当前插件封面预览'} />
                        </> : <span className="plugin-publisher-upload-icon"><ImagePlus size={24} /></span>}
                        <strong>{coverFile ? coverFile.name : plugin?.coverUrl ? '保留当前封面' : '选择插件封面'}</strong>
                        <span id={id + '-cover-hint'}>{coverFile ? fileSize(coverFile.size) + ' · 公开封面 · 点击可更换' : plugin?.coverUrl ? '未选新封面将继续使用当前封面 · 点击可更换 · 最大 5 MB' : '选填 · 公开封面 · 最大 5 MB'}</span>
                    </label>
                    {coverFile && <button type="button" className="plugin-publisher-remove-cover" onClick={removeCover}><X size={12} />{isEditing ? '移除新封面' : '移除封面'}</button>}
                </div>
            </div>
        </fieldset>

        <fieldset disabled={busy || published}>
            <legend className="plugin-publisher-section"><span>03</span>使用说明 <small>选填，每行一条</small></legend>
            <div className="plugin-publisher-fields">{detailFields.map(field => <label key={field.key} className="plugin-publisher-field" htmlFor={id + '-' + field.key}><span>{field.label}</span><textarea id={id + '-' + field.key} name={field.key} value={details[field.key]} onChange={event => { const value = event.currentTarget.value; setDetails(current => ({ ...current, [field.key]: value })); clearFieldError(field.key); }} {...fieldAria(field.key)} rows={3} maxLength={6000} placeholder={field.placeholder} /><small>{field.hint}</small></label>)}</div>
        </fieldset>

        <div className="plugin-publisher-publication">
            <div><strong>介绍与封面公开，ZIP 仅登录后可下载。</strong><p>{action}会上传所选 ZIP 至私有存储并公开插件介绍、封面。{isEditing && '未选择新封面时保留当前封面。'}仅选择文件不会上传你的本地项目。</p></div>
            <button type="submit" disabled={busy || published || serviceState !== 'ready'}>{busy || serviceState === 'checking' ? <Loader2 size={16} className="animate-spin" /> : published ? <CheckCircle2 size={16} /> : <UploadCloud size={16} />}{busy ? stageLabels[stage] + '…' : published ? '插件已' + action : serviceState === 'checking' ? '正在检查上传服务…' : serviceState === 'failed' ? '上传服务尚未就绪' : error ? '修正后上传并' + action : '上传并' + action + '插件'}</button>
        </div>
    </form>;
}
