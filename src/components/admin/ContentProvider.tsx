'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { ADMIN_EMAIL, type ContentOverride, type ContentSection } from '@/lib/admin/types';

type ContentState = { rows: ContentOverride[]; ready: boolean; loading: boolean; error: string | null; isAdmin: boolean; checking: boolean; authError: string | null; retryAdmin: () => void; refreshContent: () => Promise<void> };
const ContentContext = createContext<ContentState>({ rows: [], ready: false, loading: true, error: null, isAdmin: false, checking: true, authError: null, retryAdmin: () => {}, refreshContent: async () => {} });
export default function ContentProvider({ children }: { children: ReactNode }) {
    const [rows, setRows] = useState<ContentOverride[]>([]);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [checking, setChecking] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const alive = useRef(true);
    const contentRevision = useRef(0);
    const authRevision = useRef(0);
    const refreshContent = useCallback(async () => {
        const revision = ++contentRevision.current;
        if (alive.current) setLoading(true);
        try {
            const response = await fetch('/api/content', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
            const result = await response.json();
            if (!response.ok || !Array.isArray(result.rows)) throw new Error(result.error || '目录配置暂时无法读取。');
            if (alive.current && revision === contentRevision.current) { setRows(result.rows); setReady(true); setError(null); }
        } catch (cause) {
            if (alive.current && revision === contentRevision.current) setError(cause instanceof Error ? cause.message : '目录配置暂时无法读取。');
        } finally { if (alive.current && revision === contentRevision.current) setLoading(false); }
    }, []);
    const verifyAdmin = useCallback(async (showChecking = false) => {
        const revision = ++authRevision.current;
        if (showChecking) setChecking(true);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('账号核验超时。')), 15000); });
            const { data: { user }, error } = await Promise.race([supabase.auth.getUser(), deadline]);
            if (error && error.name !== 'AuthSessionMissingError') throw error;
            if (alive.current && revision === authRevision.current) { setIsAdmin(!error && user?.email === ADMIN_EMAIL); setAuthError(null); setChecking(false); }
        } catch {
            if (alive.current && revision === authRevision.current) { setAuthError('暂时无法核验账号，请重试。'); setChecking(false); }
        } finally { clearTimeout(timer); }
    }, []);
    const retryAdmin = useCallback(() => { void verifyAdmin(true); }, [verifyAdmin]);
    const invalidateReads = useCallback(() => { ++authRevision.current; ++contentRevision.current; }, []);
    useEffect(() => {
        alive.current = true;
        void refreshContent();
        void verifyAdmin();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') { ++authRevision.current; setIsAdmin(false); setAuthError(null); setChecking(false); return; }
            // Verify outside the SDK's auth callback; token refresh keeps the last
            // verified identity while the server check is in flight.
            queueMicrotask(() => { void verifyAdmin(); });
        });
        return () => { alive.current = false; invalidateReads(); subscription.unsubscribe(); };
    }, [refreshContent, invalidateReads, verifyAdmin]);
    const state = useMemo(() => ({ rows, ready, loading, error, isAdmin, checking, authError, retryAdmin, refreshContent }), [rows, ready, loading, error, isAdmin, checking, authError, retryAdmin, refreshContent]);
    return <ContentContext.Provider value={state}>{children}</ContentContext.Provider>;
}
export function useContentAdmin() {
    const { isAdmin, checking, authError, retryAdmin, refreshContent } = useContext(ContentContext);
    return { isAdmin, checking, authError, retryAdmin, refreshContent };
}
export function useContentCatalog<T>(section: ContentSection, base: readonly T[], key: keyof T | ((item: T) => string)): { items: T[]; loading: boolean; error: string | null } {
    const { rows, ready, loading, error } = useContext(ContentContext);
    const items = useMemo(() => {
        if (!ready && section !== 'assets' && section !== 'plugins') return [];
        const overrides = new Map(rows.filter(row => row.section === section).map(row => [row.item_id, row]));
        return base.flatMap(item => {
            const record = item as Record<string, unknown>;
            if (record.hidden === true) return [];
            const id = typeof key === 'function' ? key(item) : String(item[key]);
            const row = overrides.get(id);
            if (row?.hidden) return [];
            if (!row) return [item];
            const patch = row.patch;
            return [{ ...record, ...patch, ...(patch.options ? { options: { ...(record.options as object), ...(patch.options as object) } } : {}) } as T];
        });
    }, [section, base, key, rows, ready]);
    return { items, loading, error };
}
