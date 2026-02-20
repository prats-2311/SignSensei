import { useEffect, useState } from 'react';
import useSound from 'use-sound';
import ConfettiExplosion from 'react-confetti-explosion';
import { useLessonStore } from '../../stores/useLessonStore';

export function AudioHapticController() {
  const { mascotEmotion, status } = useLessonStore();
  const [playSuccess] = useSound('/sounds/success.ogg', { volume: 0.5 });
  const [playError] = useSound('/sounds/error.ogg', { volume: 0.5 });
  const [isExploding, setIsExploding] = useState(false);

  useEffect(() => {
    if (mascotEmotion === 'success') {
      // Audio
      playSuccess();
      
      // Haptics (10ms light pulse for success if supported)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
         navigator.vibrate(10);
      }
      
      // Visual
      setIsExploding(true);
      setTimeout(() => setIsExploding(false), 3000);
      
    } else if (mascotEmotion === 'error') {
      // Audio
      playError();
      
      // Haptics (Double pulse for error)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
         navigator.vibrate([50, 30, 50]);
      }
    }
  }, [mascotEmotion, playSuccess, playError]);

  return (
    <>
      {isExploding && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[200]">
          <ConfettiExplosion 
            force={0.8} 
            duration={3000} 
            particleCount={250} 
            width={1600}
            colors={['#d33682', '#2aa198', '#268bd2', '#cb4b16']}
          />
        </div>
      )}
    </>
  );
}
