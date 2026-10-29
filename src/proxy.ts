import { NextRequest, NextResponse } from 'next/server'
import { demoDeployment, REAL_ADMIN_API } from '@/lib/demo/mode'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // In demo mode (preview deployments) the admin works only on demo data, through
  // /api/demo. The real admin API routes stay closed there, so nothing on a
  // preview can reach the shared database through them, even with the admin cookie.
  if (pathname.startsWith('/api/')) {
    if (demoDeployment() && REAL_ADMIN_API.test(pathname)) {
      return NextResponse.json({ error: 'This preview runs the admin demo. Real admin data isn’t available here.' }, { status: 403 })
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin_token')?.value
    const validToken = process.env.ADMIN_SECRET_TOKEN

    if (!token || token !== validToken) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
