'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface RestTimerProps {
  durationSeconds: number;
  onComplete: () => void;
  onSkip: () => void;
}

export function RestTimer({ durationSeconds, onComplete, onSkip }: RestTimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [paused, setPaused] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const notifyDone = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Rest complete', { body: 'Time for your next set!' });
    }
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          notifyDone();
          onCompleteRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, notifyDone]);

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - remaining / durationSeconds);

  return (
    <div className="rest-timer">
      <p className="cam-panel-label">Rest</p>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: 'block', margin: '0 auto' }}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.9s linear' }}
        />
        <text
          x="60"
          y="68"
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fill="var(--text-primary)"
          fontFamily="'Poppins', sans-serif"
        >
          {remaining}
        </text>
      </svg>
      <div className="rest-timer-btns">
        <button type="button" className="btn btn-ghost" onClick={() => setPaused(p => !p)}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}
