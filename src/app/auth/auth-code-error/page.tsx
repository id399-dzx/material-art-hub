import Link from "next/link";
import AuthRecoveryShell from "@/components/AuthRecoveryShell";

export default function AuthCodeErrorPage() {
    return <AuthRecoveryShell title="链接无法验证" description="验证链接可能已过期或已被使用，请重新发起账号操作。"><div className="auth-recovery-success"><Link href="/forgot-password" className="auth-submit auth-submit-link">重新申请密码重置邮件</Link><p className="auth-footnote"><Link href="/login">返回登录或注册</Link></p></div></AuthRecoveryShell>;
}
