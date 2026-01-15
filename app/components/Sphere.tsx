"use client";

import React, { JSX, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAIStore } from '@/app/store/useAIStore';
import * as THREE from "three";
import { GLTF } from "three-stdlib";

type GLTFResult = GLTF & {
  nodes: {
    Sphere: THREE.Mesh;
  };
  materials: {
    DefaultMaterial: THREE.MeshStandardMaterial;
  };
};

// ✅ FIXED: Proper type definition with volume prop
type ModelProps = JSX.IntrinsicElements["group"] & {
  volume?: number;
}

export function Model({ volume = 0, ...props }: ModelProps) {
  const { nodes } = useGLTF("/glb/sphere.glb") as unknown as GLTFResult;
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  const { status, currentResponse } = useAIStore();

  useFrame((state) => {
    if (meshRef.current) {
      const baseScale = 0.8;
      let targetScale = baseScale + (volume * 0.3);

      // AI Status effects
      if (status === 'processing') {
        // Gentle pulsing while thinking
        targetScale = baseScale + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      } else if (status === 'responding') {
        // Excited expansion
        targetScale = baseScale * 1.2;
      } else if (status === 'speaking') {
        // Speaking animation
        targetScale = baseScale * 1.1 + Math.sin(state.clock.elapsedTime * 5) * 0.1;
      }

      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.2
      );
    }

    // Color based on AI emotion
    if (materialRef.current && currentResponse) {
      const emotionColors = {
        calm: new THREE.Color(0xffffff),
        excited: new THREE.Color(0x10b981),
        thinking: new THREE.Color(0x3b82f6),
        error: new THREE.Color(0xff0000),
      };

      const targetColor = emotionColors[currentResponse.emotion || 'calm'];
      materialRef.current.color.lerp(targetColor, 0.1);
    }
  });

  return (
    <group {...props} dispose={null}>
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