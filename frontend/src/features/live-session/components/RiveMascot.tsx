import { useRive } from '@rive-app/react-canvas';
import { useEffect } from 'react';
import { useLessonStore } from '../../../stores/useLessonStore';

// Using a standard high-quality Rive example for testing
// This URL will load the 'Marty' animation which has standard state machine inputs
// const RIVE_URL = "https://cdn.rive.app/animations/vehicles.riv"; // Placeholder 
// Actually, let's use a simpler known character URL if available, or just a generic one for now.
// For the Hackathon, we'd bundle a specific .riv file in /public/assets/rive/coach.riv
// I will use a placeholder URL that I know works for testing basic load.

export function RiveMascot() {
  const { status, combo } = useLessonStore();

  const { rive, RiveComponent } = useRive({
    src: "/models/mascot.riv",
    stateMachines: "bumpy",
    autoplay: true,
  });

  // Example inputs (we would replace these with actual inputs from our custom .riv file)
  // const isHappyInput = useStateMachineInput(rive, "State Machine 1", "isHappy");
  // const comboLevelInput = useStateMachineInput(rive, "State Machine 1", "comboLevel");

  useEffect(() => {
    if (rive) {
      // Logic to trigger Rive inputs based on 'status'
      // if (status === 'success' && isHappyInput) isHappyInput.value = true;
      // if (status === 'error' && isHappyInput) isHappyInput.value = false;
      
      console.log("Rive Mascot Logic Triggered:", status, combo);
    }
  }, [status, combo, rive]);

  return (
    <div className="w-32 h-32 absolute bottom-20 right-4 pointer-events-none z-10 filter drop-shadow-xl">
       <RiveComponent />
    </div>
  );
}
