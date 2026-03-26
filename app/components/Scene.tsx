"use client";

import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Model } from "./Sphere";

interface SceneProps {
  volume: number;
}

export default function Scene({ volume }: SceneProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const check = () => {
      const t = document.documentElement.getAttribute("data-theme");
      setTheme(t === "dark" ? "dark" : "light");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="scene-wrapper h-screen w-full">
      <Canvas
        shadows
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <group position={[0, 0, 0]}>
          <Model scale={0.8} volume={volume} theme={theme} />
        </group>

        {/* Original environment — gives sphere its natural look */}
        <Environment preset="warehouse" />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.3}
            luminanceSmoothing={0.8}
            intensity={theme === "dark" ? 0.1 : 0}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}