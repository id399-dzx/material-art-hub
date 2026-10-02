import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecoveryTokenHash } from "./recovery-link.ts";

type RecoveryAuth = Pick<SupabaseClient["auth"], "verifyOtp" | "updateUser" | "signOut">;
type ResetResult = { status: number; message: string; invalidLink?: boolean };

export async function resetPasswordWithToken(auth: RecoveryAuth, tokenHash: unknown, password: unknown): Promise<ResetResult> {
    if (!isRecoveryTokenHash(tokenHash)) {
        return { status: 400, message: "重置链接无效，请重新申请重置邮件。", invalidLink: true };
    }
    if (typeof password !== "string" || password.length < 8) {
        return { status: 400, message: "新密码至少需要 8 个字符。" };
    }

    // Verify the recovery proof even when a different account is already signed in.
    // Only the submit action consumes the link, so email scanners cannot consume it.
    const { data, error } = await auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error || !data.session || !data.user) {
        return { status: 401, message: "重置链接已过期、已使用或无效，请重新申请重置邮件。", invalidLink: true };
    }

    try {
        const { error: updateError } = await auth.updateUser({ password });
        if (updateError) {
            const explanation = updateError.code === "same_password"
                ? "新密码不能与旧密码相同。"
                : updateError.code === "weak_password"
                    ? "密码未满足账号安全要求，请使用更强的密码。"
                    : "密码未能更新。";
            return { status: 400, message: `${explanation}此链接已使用，请重新申请重置邮件后再试。`, invalidLink: true };
        }
        return { status: 200, message: "密码重置成功。" };
    } finally {
        // This isolated session is never written into browser cookies or returned.
        // A cleanup failure must not report an already completed update as failed.
        await auth.signOut({ scope: "local" }).catch(() => {});
    }
}
