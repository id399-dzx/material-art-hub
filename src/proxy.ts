import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
    return await updateSession(request)
}

export const config = {
    // Public pages do not need an auth-server round trip on every request.
    matcher: ['/upload/:path*', '/protected/:path*'],
}
