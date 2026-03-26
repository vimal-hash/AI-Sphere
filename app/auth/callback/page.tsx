'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/app/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session) {
          router.push('/');
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('❌ Auth callback error:', error);
        router.push('/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'var(--background)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        {/* Spinner */}
        <div className="relative w-12 h-12 mx-auto mb-6">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: '1.5px solid var(--border)',
              borderTopColor: 'var(--accent)',
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
          />
        </div>

        <p
          className="text-sm font-medium"
          style={{
            color: 'var(--foreground-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Completing sign in…
        </p>
      </motion.div>
    </div>
  );
}