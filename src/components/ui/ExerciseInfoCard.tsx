'use client';

import { getExerciseConfig } from '@/features/form-engine/exercise-config';
import { Button } from '@/components/ui/Button';

// YouTube video IDs for each exercise — replace any ID to update the reference video
const EXERCISE_VIDEOS: Record<string, string> = {
  squat:            'aclHkVaku9U',
  push_up:          'IODxDxX7oi4',
  sit_up:           'jDwoBqPH0jk',
  bicep_curl:       'ykJmrZ5v0Oo',
  lateral_raise:    '3VcKaXpzqRo',
  overhead_press:   '2yjwXTZQDDg',
  leg_raise:        'l4kQd9eWclE',
  knee_raise:       'l4kQd9eWclE',
  crunch:           'Xyd_fa5zoEU',
  pull_up:          'eGo4IYlbE5g',
  incline_db_press: '8iPEnn-ltC8',
  tricep_pushdown:  '2-LAMcpzODU',
  face_pull:        'rep4bpAt_gs',
  arnold_press:     '6Z15_WdXmVw',
  seated_cable_row: 'GZbfZ033f74',
  calf_raise:       'gwLzBv3i0S4',
  nordic_curl:      'F-ohrNO9MoU',
};

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
  const videoId = EXERCISE_VIDEOS[exerciseId];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.72)',
      zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface, #0F172A)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: 0,
        maxWidth: 440,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── YouTube embed ── */}
        {videoId && (
          <>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                title={`${config.name} reference video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  border: 'none',
                }}
              />
            </div>
            <div style={{ padding: '6px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
                Video via YouTube. Not affiliated with GymFXR.
              </p>
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                Link ↗
              </a>
            </div>
          </>
        )}

        {/* ── Info section ── */}
        <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{config.name}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <InfoRow label="Camera" value={CAMERA_ANGLE_LABEL[config.cameraAngle] ?? config.cameraAngle} />
            <InfoRow
              label="Tracks"
              value={config.isUnilateral ? 'Left + right side independently' : 'Both sides together'}
            />
            {checks.length > 0 && (
              <InfoRow label="Checks" value={checks.join(', ')} />
            )}
          </div>

          <Button onClick={onStart}>Start</Button>
        </div>

      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', minWidth: 76, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}
