import type { Metadata } from "next";
import ResetPasswordForm from "./ResetPasswordForm";
import { recoveryTokenFromParams } from "@/lib/auth/recovery-link";

export const metadata: Metadata = { title: "设置新密码 · Fesilent Reverie", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: {
    searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
    const params = await searchParams;
    const tokenHash = recoveryTokenFromParams(params);
    return <ResetPasswordForm tokenHash={tokenHash} />;
}
