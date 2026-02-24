import type { FormIssue } from '@/features/form-engine/form-engine';

export function prioritizeFeedback(issues: FormIssue[], maxCount = 2) {
  return [...issues].sort((a, b) => a.priority - b.priority).slice(0, maxCount);
}
