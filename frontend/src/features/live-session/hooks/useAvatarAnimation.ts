import { useEffect } from "react";
import { AnimationAction, AnimationMixer, LoopRepeat } from "three";
import { useLessonStore } from "../../../stores/useLessonStore";

type AnimationMap = {
  [key: string]: AnimationAction | null;
};

export function useAvatarAnimation(
  actions: AnimationMap, 
  mixer: AnimationMixer, 
  defaultAnim = "Idle",
  successAnim = "ThumbsUp",
  failAnim = "HeadShake" // or similar
) {
  const { status } = useLessonStore();

  useEffect(() => {
    // Determine which animation to play based on status
    let targetAnimName = defaultAnim;

    if (status === "success") targetAnimName = successAnim;
    if (status === "error") targetAnimName = failAnim;
    if (status === "listening") targetAnimName = "Listening"; // if available

    const targetAction = actions[targetAnimName];
    const currentAction = actions[defaultAnim]; // Simplified: Assume we always fade back to idle or from idle

    if (targetAction) {
      // Reset and play target
      targetAction.reset().fadeIn(0.5).play();
      
      // Cross-fade from current/default if it's playing and different
      if (currentAction && currentAction !== targetAction) {
        currentAction.fadeOut(0.5);
      }

      // If we are switching TO a special action (Success/Fail), we usually want it to play once then go back to Idle
      if (status === 'success' || status === 'error') {
        targetAction.setLoop(LoopRepeat, 1);
        targetAction.clampWhenFinished = true;
        
        // Note: Realistically we'd want a callback or timeout to reset 'status' to 'idle' in the store
      } else {
         targetAction.setLoop(LoopRepeat, Infinity);
      }
    }

    // Capture the current status to handle cleanup/fading out previous actions
    return () => {
       if (targetAction) {
         targetAction.fadeOut(0.5);
       }
    };

  }, [status, actions, mixer, defaultAnim, successAnim, failAnim]);
}
