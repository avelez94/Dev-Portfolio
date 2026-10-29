import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { clientIp, hit } from '@/lib/rate-limit'

function same(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function POST(request: NextRequest) {
  // Slow down password guessing: 8 attempts per 15 minutes per address (per server instance).
  const limit = hit(`admin-login:${clientIp(request.headers)}`, 8, 15 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } })
  }
  const { password } = await request.json().catch(() => ({ password: '' }))

  const adminPassword = process.env.ADMIN_PASSWORD
  const adminToken = process.env.ADMIN_SECRET_TOKEN

  if (!adminPassword || !adminToken) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (typeof password !== 'string' || !same(password, adminPassword)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('admin_token', adminToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_token')
  return response
}