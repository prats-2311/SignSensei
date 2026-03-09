import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import { useEffect } from 'react';
import { useLessonStore } from '../../../stores/useLessonStore';

// Using a standard high-quality Rive example for testing
// This URL will load the 'Marty' animation which has standard state machine inputs
// const RIVE_URL = "https://cdn.rive.app/animations/vehicles.riv"; // Placeholder 
// Actually, let's use a simpler known character URL if available, or just a generic one for now.
// For the Hackathon, we'd bundle a specific .riv file in /public/assets/rive/coach.riv
// I will use a placeholder URL that I know works for testing basic load.

export function RiveMascot() {
  const { mascotEmotion, combo } = useLessonStore();

  const { rive, RiveComponent } = useRive({
    src: "/models/mascot.riv",
    stateMachines: "bumpy",
    autoplay: true,
  });

  // Using a numeric input 'level' on the 'bumpy' state machine based on Rive docs for this example
  const levelInput = useStateMachineInput(rive, "bumpy", "level");

  useEffect(() => {
    if (rive && levelInput) {
      // The 'vehicles.riv' bump state machine uses 'level'
      // Normal/Idle state = 2
      // Bumpy/Success state = 0
      if (mascotEmotion === 'success') {
          // eslint-disable-next-line react-hooks/immutability
          levelInput.value = 0; 
      } else {
          // eslint-disable-next-line react-hooks/immutability
          levelInput.value = 2;
      }
      
      console.log("Rive Mascot Logic Triggered:", mascotEmotion, combo);
    }
  }, [mascotEmotion, combo, rive, levelInput]);

  return (
    <div className="w-32 h-32 absolute bottom-20 right-4 pointer-events-none z-10 filter drop-shadow-xl">
       <RiveComponent />
    </div>
  );
}
