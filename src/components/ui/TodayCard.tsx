import Link from 'next/link';
import type { WorkoutEventRow } from '@/lib/calendar/sessions';
import type { ProgramProgressRow } from '@/lib/programs/sessions';

interface TodayCardProps {
  event: WorkoutEventRow | null;
  activeProgram?: ProgramProgressRow | null;
}

export function TodayCard({ event, activeProgram }: TodayCardProps) {
  if (event) {
    return (
      <div className="today-card">
        <div className="today-card-body">
          <p className="today-card-label">Today</p>
          <p className="today-card-title">{event.title}</p>
          {event.notes && <p className="today-card-notes">{event.notes}</p>}
        </div>
        <Link href="/camera" className="btn btn-solid today-card-cta">
          Start
        </Link>
      </div>
    );
  }

  if (activeProgram && activeProgram.completion_percent < 100) {
    const programName = activeProgram.programTitle
      ?? activeProgram.program_slug.replace(/^ai-[a-f0-9]+-\d+$/, 'AI Program');
    return (
      <div className="today-card">
        <div className="today-card-body">
          <p className="today-card-label">Continue program</p>
          <p className="today-card-title">{programName}</p>
          <p className="today-card-notes">
            Week {activeProgram.current_week} · {activeProgram.completed_workouts}/{activeProgram.total_workouts} workouts · {activeProgram.completion_percent}%
          </p>
        </div>
        <Link href="/programs" className="btn btn-solid today-card-cta">
          Continue
        </Link>
      </div>
    );
  }

  return (
    <div className="today-card today-card-empty">
      <p className="today-card-title">No workout scheduled today</p>
      <Link href="/programs" className="btn btn-ghost">Browse programs</Link>
    </div>
  );
}
