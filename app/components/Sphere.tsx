"use client";

import * as THREE from "three";
import React, { useRef, useMemo } from "react";
import { useFrame, ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useAIStore } from "@/app/store/useAIStore";

type GLTFResult = {
  nodes: {
    Sphere: THREE.Mesh;
  };
};

type ModelProps = ThreeElements["group"] & {
  volume?: number;
  theme?: "light" | "dark";
};

/* ═══════════════════════════════════════════
   PARTICLE SHELL
   ═══════════════════════════════════════════ */
function ParticleShell({ volume = 0, count = 2000, theme = "light" }: { volume?: number; count?: number; theme?: string }) {
  const ref = useRef<THREE.Points>(null);
  const { status } = useAIStore();

  const { basePositions, normals, speeds, phases } = useMemo(() => {
    const basePositions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    const sphereRadius = 0.84;

    for (let i = 0; i < count; i++) {
      const goldenRatio = (1 + Math.sqrt(5)) / 2;
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.sin(phi) * Math.sin(theta);
      const nz = Math.cos(phi);
      const r = sphereRadius + (Math.random() - 0.5) * 0.06;
      basePositions[i * 3] = nx * r;
      basePositions[i * 3 + 1] = ny * r;
      basePositions[i * 3 + 2] = nz * r;
      normals[i * 3] = nx;
      normals[i * 3 + 1] = ny;
      normals[i * 3 + 2] = nz;
      speeds[i] = 0.5 + Math.random() * 1.5;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { basePositions, normals, speeds, phases };
  }, [count]);

  const livePositions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    arr.set(basePositions);
    return arr;
  }, [basePositions, count]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const posAttr = ref.current.geometry.attributes.position;
    let displaceMag = 0.02, displaceSpd = 0.8, turbulence = 0, waveAmp = 0.03;

    if (status === "listening") {
      displaceMag = 0.04 + volume * 0.25; displaceSpd = 1.5; turbulence = volume * 0.15; waveAmp = 0.05 + volume * 0.1;
    } else if (status === "processing") {
      displaceMag = 0.12; displaceSpd = 3.0; turbulence = 0.2; waveAmp = 0.08;
    } else if (status === "speaking") {
      displaceMag = 0.06 + volume * 0.35; displaceSpd = 2.0 + volume * 2; turbulence = volume * 0.2; waveAmp = 0.06 + volume * 0.15;
    } else if (status === "responding") {
      displaceMag = 0.08; displaceSpd = 1.5; turbulence = 0.1; waveAmp = 0.06;
    }

    for (let i = 0; i < count; i++) {
      const bx = basePositions[i * 3], by = basePositions[i * 3 + 1], bz = basePositions[i * 3 + 2];
      const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
      const speed = speeds[i], phase = phases[i];
      const wave = Math.sin(t * displaceSpd * speed + phase) * waveAmp;
      const breathe = Math.sin(t * 0.6 + phase * 0.5) * displaceMag;
      const turb = turbulence > 0 ? Math.sin(t * 8 * speed + phase * 3) * Math.cos(t * 5 + phase * 2) * turbulence : 0;
      const total = wave + breathe + turb;
      posAttr.setXYZ(i, bx + nx * total, by + ny * total, bz + nz * total);
    }
    posAttr.needsUpdate = true;
    ref.current.rotation.y = t * 0.06;
  });

  const particleColor = theme === "dark" ? "#ffffff" : "#1A1714";

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={livePositions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color={particleColor} transparent opacity={0.8} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ═══════════════════════════════════════════
   OUTER WISPS
   ═══════════════════════════════════════════ */
function OuterWisps({ volume = 0, count = 400, theme = "light" }: { volume?: number; count?: number; theme?: string }) {
  const ref = useRef<THREE.Points>(null);
  const { status } = useAIStore();

  const { positions, velocities, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const radius = 1.05 + Math.random() * 0.65;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      velocities[i] = 0.2 + Math.random() * 0.6;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, velocities, phases };
  }, [count]);

  const livePositions = useMemo(() => new Float32Array(positions), [positions]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const posAttr = ref.current.geometry.attributes.position;
    let expansion = 0, chaos = 0;
    if (status === "processing") { expansion = Math.sin(t * 3) * 0.15; chaos = 0.1; }
    else if (status === "speaking" || status === "listening") { expansion = volume * 0.25; chaos = volume * 0.08; }

    for (let i = 0; i < count; i++) {
      const bx = positions[i * 3], by = positions[i * 3 + 1], bz = positions[i * 3 + 2];
      const vel = velocities[i], phase = phases[i];
      const angle = t * vel * 0.3 + phase;
      const drift = Math.sin(angle) * 0.08;
      const vertDrift = Math.cos(t * vel * 0.2 + phase) * 0.05;
      const len = Math.sqrt(bx * bx + by * by + bz * bz);
      const nx = bx / len, ny = by / len, nz = bz / len;
      const ch = chaos > 0 ? Math.sin(t * 6 + phase * 4) * chaos : 0;
      posAttr.setXYZ(i, bx + nx * (expansion + ch) + drift * 0.3, by + ny * (expansion + ch) + vertDrift, bz + nz * (expansion + ch) + drift * 0.2);
    }
    posAttr.needsUpdate = true;
    ref.current.rotation.y = -t * 0.03;
    ref.current.rotation.x = Math.sin(t * 0.04) * 0.05;
  });

  const particleColor = theme === "dark" ? "#ffffff" : "#1A1714";

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={livePositions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.014} color={particleColor} transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ═══════════════════════════════════════════
   AMBIENT DUST
   ═══════════════════════════════════════════ */
function AmbientDust({ count = 150, theme = "light" }: { count?: number; theme?: string }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 7;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    return arr;
  }, [count]);

  useFrame((state) => { if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.005; });

  const particleColor = theme === "dark" ? "#ffffff" : "#1A1714";

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.006} color={particleColor} transparent opacity={0.3} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ═══════════════════════════════════════════
   MAIN SPHERE — YOUR ORIGINAL RAW MATERIAL
   meshStandardMaterial, roughness 0.7, metalness 0.8
   Exactly as in your original Sphere.tsx
   ═══════════════════════════════════════════ */
export function Model({ volume = 0, theme = "light", ...props }: ModelProps) {
  const { nodes } = useGLTF("/glb/sphere.glb") as any as GLTFResult;
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const { status, currentResponse } = useAIStore();

  useFrame((state) => {
    if (!meshRef.current) return;
    const baseScale = 0.8;
    let targetScale = baseScale + volume * 0.4;
    if (status === "processing") targetScale = baseScale + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    else if (status === "responding") targetScale = baseScale * 1.2;
    else if (status === "speaking") targetScale = baseScale * 1.1 + Math.sin(state.clock.elapsedTime * 5) * 0.1;

    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);

    if (materialRef.current && currentResponse) {
      const colors: Record<string, THREE.Color> = {
        calm: new THREE.Color(0xffffff),
        excited: new THREE.Color(0x10b981),
        thinking: new THREE.Color(0x3b82f6),
        error: new THREE.Color(0xff0000),
      };
      materialRef.current.color.lerp(colors[currentResponse.emotion ?? "calm"], 0.1);
    }
  });

  return (
    <group {...props}>
      <mesh ref={meshRef} geometry={nodes.Sphere.geometry}>
        <meshStandardMaterial ref={materialRef} roughness={0.7} metalness={0.8} />
      </mesh>
      <ParticleShell volume={volume} count={2000} theme={theme} />
      <OuterWisps volume={volume} count={400} theme={theme} />
      <AmbientDust count={150} theme={theme} />
    </group>
  );
}

useGLTF.preload("/glb/sphere.glb");