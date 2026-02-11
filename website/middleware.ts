import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/profile(.*)',
  '/api/protected(.*)',
  '/api/autocount(.*)',
])

// Block WordPress scanner bots
const wordPressPaths = [
  '/wp-admin',
  '/wordpress',
  '/wp-login.php',
  '/wp-content',
  '/wp-includes',
  '/xmlrpc.php',
  '/wp-config.php',
]

export default clerkMiddleware((auth, req) => {
  const { pathname } = req.nextUrl

  // Block WordPress scanner requests - return 404 immediately
  if (wordPressPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404 }
    )
  }

  // If it's a public route, don't protect it
  if (isPublicRoute(req)) {
    return
  }
  
  // If it's a protected route, protect it
  if (isProtectedRoute(req)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
