'use client';

import { useEffect } from 'react';
import { getExerciseConfig } from '@/features/form-engine/exercise-config';
import { Button } from '@/components/ui/Button';

const CAMERA_ANGLE_LABEL: Record<string, string> = {
  front: 'Face the camera directly',
  side:  'Turn sideways to the camera',
  either: 'Front or side camera works',
};

const ISSUE_LABELS: Record<string, string> = {
  squat_depth:          'Squat depth',      squat_torso_lean:     'Torso lean',
  squat_knee_cave:      'Knee cave',         squat_heel_lift:      'Heel lift',
  squat_tempo:          'Rep tempo',         push_up_depth:        'Push-up depth',
  body_alignment:       'Body alignment',    arm_symmetry:         'Arm symmetry',
  wrist_placement:      'Wrist placement',   push_up_speed:        'Rep speed',
  curl_elbow_drift:     'Elbow drift',       curl_wrist_break:     'Wrist break',
  curl_full_extension:  'Full extension',    curl_imbalance:       'Arm imbalance',
  situp_neck_strain:    'Neck strain',       situp_full_range:     'Full range',
  situp_hip_anchor:     'Foot anchor',       raise_elbow_height:   'Elbow height',
  raise_body_sway:      'Body sway',         raise_imbalance:      'Arm imbalance',
  press_head_jut:       'Head position',     press_lockout:        'Lockout',
  press_imbalance:      'Press imbalance',   press_core_stability: 'Core stability',
  crunch_neck_pull:     'Neck pull',         crunch_range:         'Range of motion',
  crunch_hip_flex:      'Hip position',      pullup_chin_over_bar: 'Chin over bar',
  pullup_full_hang:     'Full hang',         pullup_kipping:       'Kipping',
  pullup_imbalance:     'Pull imbalance',    legraise_lower_back:  'Lower back',
  legraise_full_range:  'Leg raise range',   kneeraise_symmetry:   'Knee symmetry',
};

export interface ExerciseInfoCardProps {
  exerciseId: string;
  onStart: () => void;
}

export function ExerciseInfoCard({ exerciseId, onStart }: ExerciseInfoCardProps) {
  const config = getExerciseConfig(exerciseId);
  const checks = config.formChecks.map(c => ISSUE_LABELS[c.id] ?? c.id);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const t = setTimeout(onStart, 5000);
    return () => clearTimeout(t);
  }, [onStart]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface, #0F172A)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{config.name}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', minWidth: 90 }}>Camera</span>
            <span style={{ fontSize: 14, color: 'var(--text)' }}>{CAMERA_ANGLE_LABEL[config.cameraAngle] ?? config.cameraAngle}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', minWidth: 90 }}>Tracks</span>
            <span style={{ fontSize: 14, color: 'var(--text)' }}>
              {config.isUnilateral ? 'Left + right side independently' : 'Both sides together'}
            </span>
          </div>
          {checks.length > 0 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', minWidth: 90 }}>Checks</span>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{checks.join(', ')}</span>
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Auto-starting in 5 seconds…</p>

        <Button onClick={onStart}>Start</Button>
      </div>
    </div>
  );
}
