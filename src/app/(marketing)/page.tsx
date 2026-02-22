import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function HomePage() {
  return (
    <>
      <Section
        title="FormFixer Platform"
        subtitle="Train better across form, programs, nutrition, and planning"
        description="Inspired by modern fitness app layouts: clear goals, clean dashboards, and daily habit workflows."
      >
        <div className="hero-banner">
          <h2 style={{ marginTop: 0, marginBottom: 10 }}>Your all-in-one digital fitness workflow</h2>
          <p style={{ marginTop: 0, color: '#d4e2ff', maxWidth: 660 }}>
            Real-time technique coaching + programs + nutrition + planning in one focused workspace.
          </p>
          <div style={{ marginBottom: 12 }}>
            <span className="hero-chip">Form Coaching</span>
            <span className="hero-chip">Programs</span>
            <span className="hero-chip">Nutrition</span>
            <span className="hero-chip">Calendar</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button href="/camera">Open Form Fixer</Button>
            <Button href="/programs" variant="ghost">
              Browse Programs
            </Button>
            <Button href="/nutrition" variant="ghost">
              Track Nutrition
            </Button>
          </div>
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
