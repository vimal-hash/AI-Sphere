"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, Environment } from "@react-three/drei";
import { Model } from "./Sphere";
import { AccumulativeShadows, RandomizedLight } from '@react-three/drei'
import { EffectComposer, Bloom } from "@react-three/postprocessing";
interface SceneProps {
  volume: number;
}

export default function Scene({ volume }: SceneProps) {
  return (
    <div className="h-screen w-full bg-white">
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 35 }}>
        <group position={[0, 0, 0]}>
        <Model scale={0.8} volume={volume}/>
        {/* <AccumulativeShadows temporal frames={200} color="purple" colorBlend={0.5} opacity={1} scale={10} alphaTest={0.85}>
          <RandomizedLight amount={8} radius={5} ambient={0.5} position={[5, 3, 2]} bias={0.001} />
        </AccumulativeShadows> */}
      </group>
        {/* <OrbitControls makeDefault /> */}
        <Environment preset="sunset" />

        
      </Canvas>
    </div>
  );
}