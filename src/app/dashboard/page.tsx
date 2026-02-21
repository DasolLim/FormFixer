import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function DashboardPage() {
  return (
    <Section title="Dashboard" subtitle="Progress overview placeholder" description="Future home for workout metrics, adherence, and trends.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card title="This Week" description="3 planned workouts · 1 completed" />
        <Card title="Form Score" description="Coming soon: confidence score from pose analysis." />
        <Card title="Calendar" description="Workout scheduling and reminders will be available in a later phase." />
      </div>
    </Section>
  );
}
