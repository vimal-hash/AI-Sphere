"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import Scene from "@/app/components/Scene";
import MicroPhone from '@/app/components/MicrophoneManager';
import PresenceIndicator from '@/app/components/PresenceIndicator';
import ConnectionStatus from '@/app/components/ConnectionStatus';
import UserProfile from '@/app/components/UserProfile';
import { usePresenceStore } from '@/app/store/usePresenceStore';
import { useAuthStore } from '@/app/store/useAuthStore';
import AIResponse from '@/app/components/AIResponse';
export default function Home() {
  const router = useRouter();
  const [volume, setVolume] = useState(0);
  
  const { user, loading: authLoading, initialized, initialize } = useAuthStore();
  const { connect, disconnect } = usePresenceStore();

  // Initialize auth on mount
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (initialized && !authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, initialized, router]);

  // Connect to presence when authenticated
  useEffect(() => {
    if (user) {
      connect();
      return () => {
        disconnect();
      };
    }
  }, [user, connect, disconnect]);

  // Show loading while checking auth
  if (!initialized || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render main app if not authenticated
  if (!user) {
    return null;
  }

  return (
    <main>
      <Scene volume={volume} />
      <UserProfile />
      <MicroPhone onVolumeChange={setVolume} />
      <PresenceIndicator />
      <ConnectionStatus />
      <AIResponse />
    </main>
  );
}