import { angleDeg } from '@/features/form-engine/rules/angle';

export type SquatScenario = {
  name: string;
  kneeAngleSeries: number[];
  expectedMinReps: number;
};

export const squatValidationScenarios: SquatScenario[] = [
  { name: 'idle/no movement', kneeAngleSeries: [170, 169, 171, 170, 172], expectedMinReps: 0 },
  { name: 'valid squat rep', kneeAngleSeries: [170, 150, 120, 92, 118, 145, 170], expectedMinReps: 1 },
  { name: 'shallow squat', kneeAngleSeries: [170, 155, 135, 125, 145, 170], expectedMinReps: 0 },
  { name: 'noisy low confidence frame skip', kneeAngleSeries: [170, 168, 80, 169, 171], expectedMinReps: 0 }
];

export function angleSanityCheck() {
  const a = { x: 0, y: 0 };
  const b = { x: 1, y: 0 };
  const c = { x: 2, y: 0 };
  return angleDeg(a, b, c);
}
