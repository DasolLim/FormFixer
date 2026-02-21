import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function PricingPage() {
  return (
    <Section title="Plans" subtitle="Free vs Pro" description="Payment integration is intentionally skipped for now. Pro gating exists for feature testing.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Card title="Free" description="Current plan for all users by default.">
          <ul style={{ color: 'var(--muted)', paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Squat + Push-up tracking</li>
            <li>Save session history</li>
            <li>Dashboard session list</li>
          </ul>
        </Card>
        <Card title="Pro (gated in app)" description="No live payment yet.">
          <ul style={{ color: 'var(--muted)', paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Lunge tracking unlocked</li>
            <li>Future advanced coaching features</li>
          </ul>
        </Card>
      </div>
    </Section>
  );
}
