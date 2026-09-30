import type { Metadata } from "next";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = { title: "设置新密码 · MaterialArt Hub", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: {
    searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
    const params = await searchParams;
    const tokenHash = typeof params.token_hash === "string" && /^[a-f0-9]{64}$/i.test(params.token_hash) && params.type === "recovery" ? params.token_hash : null;
    return <ResetPasswordForm tokenHash={tokenHash} />;
}
