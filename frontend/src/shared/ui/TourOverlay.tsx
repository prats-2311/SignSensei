import Joyride, {
  type CallBackProps,
  STATUS,
  EVENTS,
  type Step,
  type Styles,
} from 'react-joyride';
import { useMemo, useState } from 'react';
import { TOUR_STEPS } from './tourSteps';
import { useUserStore } from '../../stores/useUserStore';

interface TourOverlayProps {
  onComplete: () => void;
}

/** Map our tourSteps.ts format → react-joyride Step format */
function buildJoyrideSteps(): Step[] {
  return TOUR_STEPS.map((s) => ({
    target: s.target === 'body' ? 'body' : s.target,
    content: (
      <div className="text-left">
        <p className="text-sm text-white/80 leading-relaxed">{s.description}</p>
      </div>
    ),
    title: (
      <span className="text-base font-black text-white">{s.title}</span>
    ),
    placement: s.position as Step['placement'],
    // Never show the pulsing beacon — we control timing ourselves
    disableBeacon: true,
    // Allow clicking the spotlit element; prevent background clicks from closing
    spotlightClicks: true,
    // Disable per-step scroll; we control global scroll via scrollDuration
    isFixed: false,
  }));
}

const joyrideStyles: Partial<Styles> = {
  options: {
    arrowColor: '#1e1b35',
    backgroundColor: '#1e1b35',
    overlayColor: 'rgba(0, 0, 0, 0.65)',
    primaryColor: '#a855f7',
    textColor: '#e5e7eb',
    zIndex: 500,
    // Wider tooltip for readability
    width: 320,
  },
  tooltip: {
    borderRadius: '20px',
    padding: '22px',
    border: '1px solid rgba(168,85,247,0.25)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.15)',
  },
  tooltipTitle: {
    marginBottom: '10px',
    fontSize: '16px',
  },
  tooltipContent: {
    padding: '0',
    fontSize: '14px',
    lineHeight: '1.55',
  },
  tooltipFooter: {
    marginTop: '18px',
  },
  buttonNext: {
    backgroundColor: '#a855f7',
    borderRadius: '14px',
    padding: '10px 22px',
    fontWeight: 800,
    fontSize: '14px',
    letterSpacing: '0.03em',
    boxShadow: '0 4px 16px rgba(168,85,247,0.4)',
    transition: 'opacity 0.2s',
  },
  buttonBack: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 600,
    fontSize: '13px',
    marginRight: '8px',
    transition: 'color 0.2s',
  },
  buttonSkip: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: '12px',
  },
  spotlight: {
    borderRadius: '14px',
    // Smooth purple glow on the spotlight cutout
    boxShadow: '0 0 0 3px rgba(168,85,247,0.55), 0 0 0 9999px rgba(0,0,0,0.65)',
    transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
  },
  beacon: {
    display: 'none',
  },
  overlay: {
    // Smooth fade on the overlay itself
    transition: 'opacity 0.3s ease',
  },
};

export function TourOverlay({ onComplete }: TourOverlayProps) {
  const { completeTour } = useUserStore();
  const steps = useMemo(() => buildJoyrideSteps(), []);
  // Controlled step index so we can apply a delay between steps to avoid flicker
  const [stepIndex, setStepIndex] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);

  const handleCallback = (data: CallBackProps) => {
    const { status, type, index, action } = data;

    // Tour finished or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      completeTour();
      onComplete();
      return;
    }

    // Step transition — add a 180ms pause before moving so the spotlight
    // fade-out completes before the new one fades in (eliminates flicker)
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (isWaiting) return; // debounce rapid clicks
      setIsWaiting(true);
      const next = action === 'prev' ? index - 1 : index + 1;
      setTimeout(() => {
        setStepIndex(next);
        setIsWaiting(false);
      }, 180);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={true}
      stepIndex={stepIndex}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      // Smooth scroll, not instant jump
      scrollToFirstStep={true}
      scrollOffset={96}
      scrollDuration={500}
      // Padding around the spotlight cutout
      spotlightPadding={10}
      // Never close on overlay click — prevents accidental dismissal
      disableOverlayClose={true}
      // Floater (tooltip) animation — keep smooth entrance animation enabled
      floaterProps={{
        disableAnimation: false,
      }}
      styles={joyrideStyles}
      locale={{
        back: '← Back',
        close: 'Close',
        last: "Let's Sign! 🤟",
        next: 'Next →',
        skip: 'Skip tour',
      }}
      callback={handleCallback}
    />
  );
}
