"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, Loader2 } from "lucide-react";
import Link from "next/link";
import { isSupabaseConnectionError, supabase } from "@/lib/supabase";
import { loginUrl, safeReturnTo } from "@/lib/auth/return-to";
import ResourceDialog from "@/components/resources/ResourceDialog";
import "./action-login.css";

export function useActionLogin() {
  const [checking, setChecking] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [prompt, setPrompt] = useState<{ purpose: string; returnTo: string; error?: string } | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    supabase.auth.getSession().then(({ data: { session } }) => { if (alive.current) setIsAuthenticated(Boolean(session)); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive.current) setIsAuthenticated(Boolean(session));
    });
    return () => { alive.current = false; subscription.unsubscribe(); };
  }, []);

  const requestLogin = useCallback(async (purpose: string, returnTo: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setChecking(true);
    const destination = safeReturnTo(returnTo);
    try {
      // Verify the current session with the auth service on each restricted action.
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!alive.current) return false;
      if (user && !error) { setIsAuthenticated(true); setPrompt(null); return true; }
      setIsAuthenticated(false);
      setPrompt({ purpose, returnTo: destination, ...(isSupabaseConnectionError(error) ? { error: "账号验证暂时无法连接，请稍后重试。" } : {}) });
      return false;
    } catch {
      if (alive.current) setPrompt({ purpose, returnTo: destination, error: "账号验证暂时无法连接，请稍后重试。" });
      return false;
    } finally {
      busy.current = false;
      if (alive.current) setChecking(false);
    }
  }, []);

  const showLogin = useCallback((purpose: string, returnTo: string) => {
    setIsAuthenticated(false);
    setPrompt({ purpose, returnTo: safeReturnTo(returnTo) });
  }, []);

  const LoginPrompt = <ResourceDialog open={prompt !== null} onClose={() => setPrompt(null)} title="登录后继续" eyebrow="FESILENT REVERIE / ACCOUNT"
    footer={prompt && <><button type="button" className="resource-button" onClick={() => setPrompt(null)}>继续浏览</button><Link className="resource-button resource-button--primary" href={loginUrl(prompt.returnTo)}>登录 / 注册 <ArrowRight size={16} /></Link></>}>
    {prompt && <div className="action-login"><span className="action-login-icon"><LockKeyhole size={26} strokeWidth={1.6} /></span><h3>{prompt.purpose}需要登录账号</h3><p>页面、卡片与分类可以自由浏览。登录后返回当前内容继续操作。</p>{prompt.error && <p className="action-login-error" role="alert">{prompt.error}</p>}{checking && <p role="status"><Loader2 size={14} className="action-login-spin" />正在验证账号…</p>}</div>}
  </ResourceDialog>;
  return { checking, isAuthenticated, requestLogin, showLogin, LoginPrompt };
}
