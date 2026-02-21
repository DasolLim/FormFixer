import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function HomePage() {
  return (
    <>
      <Section
        title="FormFixer"
        subtitle="Move smarter with camera-ready feedback"
        description="A modern fitness platform for safer technique, better reps, and future-ready coaching."
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button href="/camera">Try Camera Placeholder</Button>
          <Button href="/pricing" variant="ghost">
            View Pricing
          </Button>
        </div>
      </Section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card title="Live Form Guidance" description="MediaPipe-ready shell for upcoming real-time movement correction." />
        <Card title="Smart Dashboard" description="Track sessions, consistency, and upcoming workouts in one clean view." />
        <Card title="Nutrition & Wellness" description="Reserved for food-photo macro tracking and meal planning in a later phase." />
      </section>
    </>
  );
}
