import { useEffect, useRef } from "react";
import { AnimationAction, AnimationMixer, LoopRepeat } from "three";
import { useLessonStore } from "../../../stores/useLessonStore";

type AnimationMap = {
  [key: string]: AnimationAction | null;
};

export function useAvatarAnimation(
  actions: AnimationMap, 
  mixer: AnimationMixer | null
) {
  const { status } = useLessonStore();
  const currentActionRef = useRef<AnimationAction | null>(null);

  useEffect(() => {
    // If no actions are loaded yet, do nothing
    if (!actions || Object.keys(actions).length === 0) return;

    // Get the primary animation (the only one in our demo GLB)
    const animationNames = Object.keys(actions);
    const targetAnimName = animationNames[0]; // Just play the first one we find
    
    if (!targetAnimName) return;

    const targetAction = actions[targetAnimName];

    if (targetAction && targetAction !== currentActionRef.current) {
      if (currentActionRef.current) {
         currentActionRef.current.fadeOut(0.5);
      }
      
      console.log("PLAYING ANIMATION:", targetAnimName);
      targetAction.reset();
      targetAction.setEffectiveTimeScale(1);
      targetAction.setEffectiveWeight(1);
      targetAction.play();
      targetAction.setLoop(LoopRepeat, Infinity);
      
      currentActionRef.current = targetAction;
    }

    // Capture the current status to handle cleanup
    return () => {
       if (currentActionRef.current) {
         currentActionRef.current.fadeOut(0.5);
       }
    };

  }, [status, actions, mixer]);
}
