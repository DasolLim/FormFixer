import Link from 'next/link';
import type { WorkoutEventRow } from '@/lib/calendar/sessions';

interface TodayCardProps {
  event: WorkoutEventRow | null;
}

export function TodayCard({ event }: TodayCardProps) {
  if (!event) {
    return (
      <div className="today-card today-card-empty">
        <p className="today-card-title">No workout scheduled today</p>
        <Link href="/programs" className="btn btn-ghost">Browse programs</Link>
      </div>
    );
  }

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
