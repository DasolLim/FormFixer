import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function PricingPage() {
  return (
    <Section title="Platform Access" subtitle="Current rollout" description="All current features are available in this phase. Billing is deferred.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Card title="v3 Access" description="Form fixing, programs, nutrition, and calendar tools are all enabled.">
          <ul style={{ color: 'var(--muted)', paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Multi-exercise form tracking</li>
            <li>Coaching programs + progress</li>
            <li>USDA meal logging + macro dashboard</li>
            <li>Workout planning calendar</li>
          </ul>
        </Card>
      </div>
    </Section>
  );
}
