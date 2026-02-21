import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function PricingPage() {
  return (
    <Section title="Pricing" subtitle="Free vs Pro" description="Stripe-ready UI placeholders (no checkout flow in v0).">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Card title="Free" description="Basic form-fixing support and simple movement feedback.">
          <ul style={{ color: 'var(--muted)', paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Camera placeholder support</li>
            <li>Basic dashboard widgets</li>
            <li>Limited workout history</li>
          </ul>
          <Button style={{ marginTop: 12 }}>Start Free</Button>
        </Card>
        <Card title="Pro" description="$19/month · advanced coaching roadmap">
          <ul style={{ color: 'var(--muted)', paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Advanced movement analysis (planned)</li>
            <li>Structured programs (planned)</li>
            <li>Nutrition + wellness add-ons (planned)</li>
          </ul>
          <Button style={{ marginTop: 12 }}>Subscribe (Stripe Placeholder)</Button>
        </Card>
      </div>
    </Section>
  );
}
