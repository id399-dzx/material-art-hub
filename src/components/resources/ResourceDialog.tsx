"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type ResourceDialogProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    eyebrow?: string;
    children: ReactNode;
    footer?: ReactNode;
};

export default function ResourceDialog({ open, onClose, title, eyebrow, children, footer }: ResourceDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog || !open) return;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            dialog.close();
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    return <dialog ref={dialogRef} className="resource-dialog" aria-labelledby={titleId}
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
        }}>
        <header className="resource-dialog__header">
            <div>{eyebrow && <span className="resource-eyebrow">{eyebrow}</span>}<h2 id={titleId}>{title}</h2></div>
            <button type="button" className="resource-dialog__close" aria-label="关闭简介" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="resource-dialog__body">{children}</div>
        {footer && <footer className="resource-dialog__footer">{footer}</footer>}
    </dialog>;
}
