"use client";

import * as THREE from "three";
import React, { useRef } from "react";
import { useFrame, ThreeElements } from "@react-three/fiber";

import { useGLTF } from "@react-three/drei";
import { useAIStore } from "@/app/store/useAIStore";

type GLTFResult = {
  nodes: {
    Sphere: THREE.Mesh;
  };
};

type ModelProps = ThreeElements['group'] & {
  volume?: number;
}

export function Model({ volume = 0, ...props }: ModelProps) {
  const { nodes } = useGLTF("/glb/sphere.glb") as any as GLTFResult;

  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const { status, currentResponse } = useAIStore();

  useFrame((state) => {
    if (!meshRef.current) return;

    const baseScale = 0.8;
    let targetScale = baseScale + volume * 0.3;

    if (status === "processing") {
      targetScale = baseScale + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    } else if (status === "responding") {
      targetScale = baseScale * 1.2;
    } else if (status === "speaking") {
      targetScale =
        baseScale * 1.1 +
        Math.sin(state.clock.elapsedTime * 5) * 0.1;
    }

    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.2
    );

    if (materialRef.current && currentResponse) {
      const colors: Record<string, THREE.Color> = {
        calm: new THREE.Color(0xffffff),
        excited: new THREE.Color(0x10b981),
        thinking: new THREE.Color(0x3b82f6),
        error: new THREE.Color(0xff0000),
      };

      materialRef.current.color.lerp(
        colors[currentResponse.emotion ?? "calm"],
        0.1
      );
    }
  });

  return (
    <group {...props}>
      <mesh ref={meshRef} geometry={nodes.Sphere.geometry}>
        <meshStandardMaterial
          ref={materialRef}
          roughness={0.7}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload("/glb/sphere.glb");
