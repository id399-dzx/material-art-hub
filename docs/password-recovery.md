# 密码找回配置

## Supabase 配置

- Site URL：`https://fesilent.com`。
- Redirect URLs：添加 `https://fesilent.com/reset-password` 和 `https://material-art-hub.vercel.app/reset-password`。
- Authentication → Emails → Reset password：主题为「重置 Fesilent Reverie 密码」，正文使用 `supabase/templates/recovery.html`。
- 邮件模板通过 `.SiteURL` 指向正式站点，使用 `.TokenHash` 与 `type=recovery`。不要改回 `.ConfirmationURL`，该默认链接与本站的重置接口不同。
- 复制部署到其他站点时，先更新 Site URL，部署这两个页面和接口，再更新邮件模板。

Supabase 内置邮件服务仅向组织成员邮箱发送邮件，当前每小时最多 2 封。向普通用户提供注册和密码找回时，需要在 Authentication → Emails → SMTP Settings 配置独立邮件服务。参见 [Supabase SMTP 文档](https://supabase.com/docs/guides/auth/auth-smtp)。

## 流程

1. `/login` → 忘记密码 → `/forgot-password`，用户提交注册邮箱。
2. 邮件链接打开 `/reset-password?token_hash=…&type=recovery`，打开页面不消耗链接。
3. 用户填写新密码和确认密码，客户端先检查一致性，再提交 `/api/auth/reset-password`。
4. 接口使用独立 Supabase 客户端验证一次性 recovery token，再更新密码并结束临时会话。不使用已有账号 Cookie，不返回临时会话，不需要 service role key。
5. 成功后用户用新密码登录。失效、已使用的链接会引导重新申请。

如 Supabase 验证成功后拒绝新密码（例如与旧密码相同），链接已消耗，页面会提示重新申请。若提交后网络中断，先尝试新密码登录，避免把已成功的操作误认为失败。

## 链接格式

页面和接口共用 `src/lib/auth/recovery-link.ts`。Supabase 使用 SHA-224 生成 56 位十六进制哈希，PKCE 流程还会加上 `pkce_` 前缀；验证时必须原样保留前缀。本站接受这两种格式，并兼容旧的 64 位哈希格式。参见 [Supabase 哈希实现](https://github.com/supabase/auth/blob/master/internal/crypto/crypto.go) 和 [恢复邮件实现](https://github.com/supabase/auth/blob/master/internal/api/mail.go)。

本地格式检查不代表链接有效；链接归属、有效期和是否已使用均通过 Supabase 的 `verifyOtp` 检查。此前页面和接口限定为 64 位，导致新的 56 位或 PKCE 链接在请求 Supabase 之前就被拒绝，显示「未找到有效的密码重置链接」。

## 验证

```sh
node --experimental-strip-types --test src/lib/auth/password-recovery.test.mjs
npm run build
```

回归测试覆盖 56 位、PKCE 前缀和旧 64 位格式的原样验证，以及参数错误、证明过期、密码更新、临时会话清理等情况。

人工验收使用本人可收信的账号：申请邮件 → 打开最新邮件链接 → 输入两次新密码 → 更新 → 新密码登录 → 重复使用旧链接应失败。新密码由账号本人输入和提交。
