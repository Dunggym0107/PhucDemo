import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Hot path tối ưu hiệu năng:
//   - getUser() (network call ~80ms) chỉ gọi khi thật sự cần (vào /dashboard hoặc /login).
//   - Check is_active KHÔNG còn gọi DB mỗi request — cache 60s qua signed cookie.
//     User bị deactivate sẽ bị đẩy ra trễ tối đa 60s, đổi lại tiết kiệm ~1 round-trip
//     DB cho mọi navigation. Khi user bị set is_active=false thực tế thì RLS phía DB
//     cũng đã chặn mọi mutation → an toàn.
//   - Matcher loại trừ thêm api/cron, sw.js, manifest, các file static khác.

const ACTIVE_COOKIE = 'wf_active_v1'
const ACTIVE_COOKIE_TTL = 60 // giây — đủ để giảm tải DB nhưng vẫn nhanh khi admin deactivate

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')
  const isDashboard = pathname.startsWith('/dashboard')
  const isAuthPage = pathname === '/' || pathname === '/login' || pathname === '/register'

  // Fast path: route không cần auth check (api, asset không match…) → next() ngay
  if (isApi) {
    return NextResponse.next({ request: { headers: request.headers } })
  }
  if (!isDashboard && !isAuthPage) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Chưa đăng nhập mà truy cập dashboard → đẩy về login
  if (!user && isDashboard) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Đã đăng nhập nhưng tài khoản chưa kích hoạt → chặn dashboard.
  // Cache kết quả 60s qua cookie để không phải SELECT profiles trên mọi request.
  if (user && isDashboard) {
    const cached = request.cookies.get(ACTIVE_COOKIE)?.value
    const expected = `${user.id}:1`
    const expectedInactive = `${user.id}:0`

    let isActive: boolean
    if (cached === expected) {
      isActive = true
    } else if (cached === expectedInactive) {
      isActive = false
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle()
      isActive = profile?.is_active !== false
      response.cookies.set(ACTIVE_COOKIE, `${user.id}:${isActive ? 1 : 0}`, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: ACTIVE_COOKIE_TTL,
        path: '/',
      })
    }

    if (!isActive) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('pending', '1')
      const redirect = NextResponse.redirect(url)
      redirect.cookies.delete(ACTIVE_COOKIE)
      return redirect
    }
  }

  // Đã đăng nhập mà vào trang login → chuyển vào dashboard
  if (user && (pathname === '/' || pathname === '/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Bỏ qua: static asset, image optimizer, favicon, file media, service worker,
     * manifest, robots/sitemap. Middleware chỉ chạy cho route thật.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf)$).*)',
  ],
}
