import Link from 'next/link';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { PROGRAMS } from '@/lib/programs/catalog';

export default function ProgramsPage() {
  return (
    <Section title="Program Library" subtitle="Coaching Programs" description="Browse guided training programs and start one anytime.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {PROGRAMS.map((program) => (
          <Card key={program.slug} title={program.title} description={program.description}>
            <p style={{ margin: '0 0 10px 0', color: 'var(--muted)' }}>
              {program.difficulty} · {program.durationWeeks} weeks · Coach {program.coachName}
            </p>
            <Link href={`/programs/${program.slug}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
              View Program →
            </Link>
          </Card>
        ))}
      </div>
    </Section>
  );
}
