import { ADMIN_EMAIL } from './types.ts';

export class ContentHttpError extends Error {
    readonly status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
}
type AuthClient = { auth: { getUser(): Promise<{ data: { user: { email?: string } | null }; error: unknown }> } };
export async function requireContentAdministrator(client: AuthClient): Promise<void> {
    let result: Awaited<ReturnType<AuthClient['auth']['getUser']>>;
    try { result = await client.auth.getUser(); }
    catch { throw new ContentHttpError('账号服务暂时无法连接，请稍后重试。', 503); }
    if (result.error || !result.data.user) throw new ContentHttpError('请先登录管理员账号。', 401);
    if (result.data.user.email !== ADMIN_EMAIL) throw new ContentHttpError('只有管理员可以管理网站内容。', 403);
}
