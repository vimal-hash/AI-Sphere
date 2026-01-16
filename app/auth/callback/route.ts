import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')

  console.log('🔐 Auth callback received')

  // Handle OAuth errors
  if (error) {
    console.error('❌ OAuth error:', error)
    return NextResponse.redirect(`${requestUrl.origin}/login`)
  }

  // Exchange authorization code for session
  if (code) {
    try {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('❌ Code exchange error:', exchangeError)
        return NextResponse.redirect(`${requestUrl.origin}/login`)
      }

      console.log('✅ Session created successfully')
      return NextResponse.redirect(`${requestUrl.origin}/`)

    } catch (err) {
      console.error('❌ Callback error:', err)
      return NextResponse.redirect(`${requestUrl.origin}/login`)
    }
  }

  // No code - redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}