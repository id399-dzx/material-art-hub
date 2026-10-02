/** Validate the link shape only; Supabase verifies ownership, expiry and single use on submit. */
export function isRecoveryTokenHash(value: unknown): value is string {
    // Supabase uses SHA-224 (56 hex digits), optionally prefixed for PKCE.
    // Keep legacy 64-digit links compatible, and never remove the PKCE prefix.
    return typeof value === "string" && /^(?:pkce_)?(?:[a-f0-9]{56}|[a-f0-9]{64})$/i.test(value);
}

export function recoveryTokenFromParams(params: { token_hash?: unknown; type?: unknown }): string | null {
    return params.type === "recovery" && isRecoveryTokenHash(params.token_hash) ? params.token_hash : null;
}
