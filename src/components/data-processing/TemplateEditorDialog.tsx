'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import './template-editor-dialog.css';

export default function TemplateEditorDialog({ open, title, eyebrow, description, busy = false, contentClassName = '', onClose, children }: {
    open: boolean;
    title: string;
    eyebrow: string;
    description: string;
    busy?: boolean;
    contentClassName?: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const titleId = useId(), descriptionId = useId();
    const backdropPress = useRef(false);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (!open) { if (dialog.open) dialog.close(); return; }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (!dialog.open) dialog.showModal();
        contentRef.current?.scrollTo({ top: 0, left: 0 });
        dialog.focus({ preventScroll: true });
        return () => {
            document.body.style.overflow = previousOverflow;
            if (dialog.open) dialog.close();
        };
    }, [open]);

    return <dialog ref={dialogRef} className="template-editor-dialog" tabIndex={-1} aria-labelledby={titleId} aria-describedby={descriptionId}
        onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
        onPointerDown={event => { backdropPress.current = event.target === event.currentTarget; }}
        onClick={event => {
            if (!busy && backdropPress.current && event.target === event.currentTarget) {
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
            }
            backdropPress.current = false;
        }}>
        <header className="template-dialog-header">
            <div><span className="template-dialog-eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
            <button type="button" className="template-dialog-close" aria-label="关闭编辑，返回模板列表" disabled={busy} onClick={onClose}><X size={20} /></button>
        </header>
        <div ref={contentRef} className={`template-dialog-content${contentClassName ? ` ${contentClassName}` : ''}`}>{children}</div>
        <footer className="template-dialog-footer"><span>{busy ? '正在处理，请稍候…' : '关闭后保留本次页面中的编辑；刷新前请保存结果。'}</span><button type="button" disabled={busy} onClick={onClose}><ArrowLeft size={15} />返回模板列表</button></footer>
    </dialog>;
}
