import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function HomePage() {
  return (
    <>
      <Section
        title="FormFixer Platform"
        subtitle="Train better across form, programs, nutrition, and planning"
        description="Use real-time form feedback, coaching programs, meal tracking, and calendar planning in one app."
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button href="/camera">Open Form Fixer</Button>
          <Button href="/programs" variant="ghost">
            Browse Programs
          </Button>
          <Button href="/nutrition" variant="ghost">
            Nutrition
          </Button>
        </div>
      </Section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card title="Form Fixing" description="Live camera form guidance for squat, push-up, and lunge." />
        <Card title="Coaching Programs" description="Structured week-by-week programs with progress tracking." />
        <Card title="Nutrition Tracking" description="USDA-powered food search plus manual macro logging." />
        <Card title="Workout Calendar" description="Schedule sessions and track weekly consistency." />
      </section>
    </>
  );
}
