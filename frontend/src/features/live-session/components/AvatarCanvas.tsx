import { Canvas } from "@react-three/fiber";
import { Environment, useGLTF, useAnimations } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarAnimation } from "../hooks/useAvatarAnimation";

// Preload the model to avoid pop-in
// Using a local demo RiggedFigure avatar
const MODEL_URL = "/models/avatar.glb";
useGLTF.preload(MODEL_URL);

function Avatar() {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  // const { status } = useLessonStore(); // Moved to hook
  
  // Connect the store state to animations
  // Note: 'mixer' is available from the useAnimations hook under the hood, but the hook returns { actions, mixer }
  // We need to cast or access it if we want to pass it explicitly, but usually actions are bound to the internal mixer.
  // Actually, useAnimations returns { actions, names, ref, mixer }.
  // Let's check how we called it: const { actions } = useAnimations(animations, group);
  // We can just get mixer from there.
  
  const { actions: animationActions, mixer } = useAnimations(animations, group);

  useAvatarAnimation(animationActions as any, mixer, "Idle", "ThumbsUp", "HeadShake");

  useEffect(() => {
     // Debug logging
     if (animationActions) {
        console.log("Available Avatar Animations:", Object.keys(animationActions));
     }
  }, [animationActions]);

  return (
    <group ref={group} dispose={null} position={[0, -2, 0]}>
      <primitive object={scene} scale={2} />
    </group>
  );
}

export function AvatarCanvas() {
  return (
    <div className="w-full h-[400px] absolute bottom-0 left-0 z-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <pointLight position={[-10, -10, -10]} />
        
        <Avatar />
        
        <Environment preset="city" />
        {/* OrbitControls allowed for debugging, but pointer-events-none on container prevents interaction by default */}
        {/* <OrbitControls enableZoom={false} /> */}
      </Canvas>
    </div>
  );
}
