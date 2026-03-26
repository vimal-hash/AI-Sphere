"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Scene from "@/app/components/Scene";
import MicroPhone from "@/app/components/MicrophoneManager";
import PresenceIndicator from "@/app/components/PresenceIndicator";
import ConnectionStatus from "@/app/components/ConnectionStatus";
import UserProfile from "@/app/components/UserProfile";
import { usePresenceStore } from "@/app/store/usePresenceStore";
import { useAuthStore } from "@/app/store/useAuthStore";
import AIResponse from "@/app/components/AIResponse";

/* ═══════════════════════════════════════════
   THEME MANAGEMENT
   ═══════════════════════════════════════════ */
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("sphere-theme") as
      | "light"
      | "dark"
      | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("sphere-theme", next);
  }, [theme]);

  return { theme, toggleTheme };
}

/* ═══════════════════════════════════════════
   CREATIVE BACKGROUND — Animated geometric
   ornaments, radial glow, fine grid lines
   ═══════════════════════════════════════════ */
function CreativeBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Radial glow behind the sphere */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(70vw, 700px)",
          height: "min(70vw, 700px)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, var(--accent-glow) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />

      {/* Secondary warm glow — offset */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute"
        style={{
          top: "35%",
          left: "55%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(212,168,67,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Fine crosshair lines through center */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute inset-0"
      >
        {/* Horizontal line */}
        <div
          className="absolute top-1/2 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, var(--border) 30%, var(--border-accent) 50%, var(--border) 70%, transparent 100%)",
            opacity: 0.3,
          }}
        />
        {/* Vertical line */}
        <div
          className="absolute left-1/2 top-0 bottom-0 w-px"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, var(--border) 30%, var(--border-accent) 50%, var(--border) 70%, transparent 100%)",
            opacity: 0.3,
          }}
        />
      </motion.div>

      {/* Corner ornaments — thin golden brackets */}
      {/* Top-Left */}
      <motion.div
        initial={{ opacity: 0, x: -10, y: -10 }}
        animate={{ opacity: 0.35, x: 0, y: 0 }}
        transition={{ duration: 0.8, delay: 1.0 }}
        className="absolute top-8 left-8"
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M1 16V2C1 1.448 1.448 1 2 1H16"
            stroke="var(--accent)"
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
      {/* Top-Right */}
      <motion.div
        initial={{ opacity: 0, x: 10, y: -10 }}
        animate={{ opacity: 0.35, x: 0, y: 0 }}
        transition={{ duration: 0.8, delay: 1.1 }}
        className="absolute top-8 right-8"
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M24 1H38C38.552 1 39 1.448 39 2V16"
            stroke="var(--accent)"
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
      {/* Bottom-Left */}
      <motion.div
        initial={{ opacity: 0, x: -10, y: 10 }}
        animate={{ opacity: 0.35, x: 0, y: 0 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="absolute bottom-8 left-8"
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M1 24V38C1 38.552 1.448 39 2 39H16"
            stroke="var(--accent)"
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
      {/* Bottom-Right */}
      <motion.div
        initial={{ opacity: 0, x: 10, y: 10 }}
        animate={{ opacity: 0.35, x: 0, y: 0 }}
        transition={{ duration: 0.8, delay: 1.3 }}
        className="absolute bottom-8 right-8"
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M24 39H38C38.552 39 39 38.552 39 38V24"
            stroke="var(--accent)"
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      {/* Diagonal accent lines — very subtle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ duration: 1.5, delay: 1.5 }}
        className="absolute inset-0"
      >
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1="0" y1="0" x2="100" y2="100" stroke="var(--accent)" strokeWidth="0.05" />
          <line x1="100" y1="0" x2="0" y2="100" stroke="var(--accent)" strokeWidth="0.05" />
        </svg>
      </motion.div>

      {/* Concentric circles — geometric reference */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.6 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      >
        <svg
          width="600"
          height="600"
          viewBox="0 0 600 600"
          fill="none"
          className="w-[min(80vw,600px)] h-[min(80vw,600px)]"
        >
          <circle cx="300" cy="300" r="180" stroke="var(--border)" strokeWidth="0.5" opacity="0.3" />
          <circle cx="300" cy="300" r="230" stroke="var(--border)" strokeWidth="0.3" opacity="0.15" />
          <circle cx="300" cy="300" r="280" stroke="var(--border)" strokeWidth="0.3" opacity="0.08" />
          {/* Small tick marks around inner circle */}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 10 * Math.PI) / 180;
            const r1 = 175;
            const r2 = 185;
            return (
              <line
                key={i}
                x1={300 + r1 * Math.cos(angle)}
                y1={300 + r1 * Math.sin(angle)}
                x2={300 + r2 * Math.cos(angle)}
                y2={300 + r2 * Math.sin(angle)}
                stroke="var(--accent)"
                strokeWidth="0.4"
                opacity={i % 9 === 0 ? "0.4" : "0.12"}
              />
            );
          })}
        </svg>
      </motion.div>

      {/* Subtle label — "Sphere" watermark below sphere */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.6 }}
        className="absolute bottom-[22%] left-1/2 -translate-x-1/2"
      >
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "var(--foreground-subtle)",
            opacity: 0.4,
          }}
        >
          Sphere
        </p>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   THEME TOGGLE BUTTON
   ═══════════════════════════════════════════ */
function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onToggle}
      className="fixed bottom-6 left-6 z-50 group"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <div
        className="w-10 h-10 flex items-center justify-center rounded-full glass transition-all duration-300 group-hover:shadow-lg"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <AnimatePresence mode="wait">
          {theme === "light" ? (
            <motion.svg
              key="moon"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-[18px] h-[18px]"
              fill="none"
              stroke="var(--foreground-secondary)"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
              />
            </motion.svg>
          ) : (
            <motion.svg
              key="sun"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-[18px] h-[18px]"
              fill="none"
              stroke="var(--foreground-secondary)"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════
   LOADING SCREEN — Cinematic reveal
   ═══════════════════════════════════════════ */
function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--background)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        {/* Elegant dual-ring spinner */}
        <div className="relative w-16 h-16 mx-auto mb-8">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: "1.5px solid var(--border)",
              borderTopColor: "var(--accent)",
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-2 rounded-full"
            style={{
              border: "1.5px solid var(--border)",
              borderBottomColor: "var(--accent-light)",
            }}
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
          />
          {/* Center dot */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ background: "var(--accent)" }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        </div>

        <h1
          className="font-display text-2xl font-semibold mb-2"
          style={{ color: "var(--foreground)" }}
        >
          Sphere
        </h1>
        <p
          style={{
            color: "var(--foreground-muted)",
            fontFamily: "var(--font-body)",
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            fontSize: "11px",
          }}
        >
          Initializing
        </p>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE — Orchestrated entrance
   ═══════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const [volume, setVolume] = useState(0);
  const { theme, toggleTheme } = useTheme();

  const { user, loading: authLoading, initialized, initialize } = useAuthStore();
  const { connect, disconnect } = usePresenceStore();

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    if (initialized && !authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, initialized, router]);

  useEffect(() => {
    if (user) {
      connect();
      return () => {
        disconnect();
      };
    }
  }, [user, connect, disconnect]);

  if (!initialized || authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  return (
    <main
      className="relative overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Creative animated background layer */}
      <CreativeBackground />

      {/* 3D Scene */}
      <Scene volume={volume} />

      {/* UI Overlay */}
      <div className="fixed inset-0 z-10 pointer-events-none">
        {/* Top Bar — staggered entrance */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.3,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="absolute top-0 left-0 right-0 flex items-start justify-between p-5 pointer-events-auto"
        >
          <UserProfile />
          <PresenceIndicator />
        </motion.div>

        {/* Left Controls */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="pointer-events-auto"
        >
          <MicroPhone onVolumeChange={setVolume} />
        </motion.div>

        {/* Bottom Response */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="pointer-events-auto"
        >
          <AIResponse />
        </motion.div>

        {/* Connection Status */}
        <div className="pointer-events-auto">
          <ConnectionStatus />
        </div>
      </div>

      {/* Theme Toggle */}
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </main>
  );
}