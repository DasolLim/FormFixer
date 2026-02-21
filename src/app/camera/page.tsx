'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function CameraPage() {
  const [isCameraRunning, setIsCameraRunning] = useState(false);

  return (
    <Section title="Camera / Form Fixer" subtitle="MediaPipe-ready placeholder" description="This shell is ready for pose landmarks + live form analysis in v1.">
      <Card>
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 920,
            aspectRatio: '16 / 9',
            borderRadius: 14,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            background: '#0b1325'
          }}
        >
          <video
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25, background: '#15213f' }}
            muted
            playsInline
          />
          <canvas
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />
          <div style={{ position: 'absolute', left: 12, bottom: 12, color: 'var(--muted)' }}>
            Camera feed + pose overlay placeholder
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <Button onClick={() => setIsCameraRunning(true)}>Start Camera</Button>
          <Button onClick={() => setIsCameraRunning(false)} variant="ghost">
            Stop Camera
          </Button>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Card title="Live Feedback" description="Posture cues will appear here in real time." />
          <Card title="Rep Counter" description="Exercise-specific rep and tempo tracking will be added in v1." />
          <Card title="Status" description={isCameraRunning ? 'Camera UI: Running (placeholder)' : 'Camera UI: Stopped (placeholder)'} />
        </div>
      </Card>
    </Section>
  );
}
