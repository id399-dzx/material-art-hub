import { createClient } from '@/utils/supabase/client';

// Share the SSR cookie session with the callback route and server helpers.
// A separate supabase-js browser client would keep a second session in localStorage.
export const supabase = createClient();

export function getSupabaseErrorMessage(error: unknown): string | null {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message;
    }
    return null;
}

export function isSupabaseConnectionError(error: unknown): boolean {
    const message = getSupabaseErrorMessage(error);
    return message !== null && /failed to fetch|fetch failed|network request failed|networkerror|load failed|enotfound|err_name_not_resolved/i.test(message);
}
