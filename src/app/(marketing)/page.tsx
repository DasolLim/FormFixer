import Link from 'next/link';
import {
  Camera,
  Dumbbell,
  Apple,
  Users,
  ArrowRight,
  ChevronRight,
  Activity,
  Zap,
  Target,
} from 'lucide-react';

const features = [
  {
    icon: Camera,
    title: 'Real-Time AI Form Detection',
    desc: 'Your camera becomes a personal coach. Get instant feedback on every rep as our AI tracks 33 body landmarks at 30fps.',
  },
  {
    icon: Dumbbell,
    title: 'Guided Workout Programs',
    desc: 'Follow structured programs built by coaches. Track progress week by week and stay on schedule.',
  },
  {
    icon: Apple,
    title: 'Nutrition Tracking',
    desc: 'Search the USDA database, log meals by type, and see your macros add up throughout the day.',
  },
  {
    icon: Users,
    title: 'Social Community',
    desc: 'Connect with friends, send gym invites, and share your progress. Training is better together.',
  },
];

const steps = [
  {
    num: '01',
    title: 'Open Camera',
    desc: 'Grant camera access and position yourself in frame. GymFXR auto-calibrates to your body in seconds.',
  },
  {
    num: '02',
    title: 'Pick an Exercise',
    desc: 'Choose from 10+ supported exercises — squats, push-ups, bicep curls, shoulder press, and more.',
  },
  {
    num: '03',
    title: 'Train with Live Feedback',
    desc: 'Voice cues and on-screen prompts guide every rep. Your form score updates in real time.',
  },
];

const programs = [
  { name: 'Strength Fundamentals', meta: '4 weeks · Beginner · Full body',    icon: Dumbbell  },
  { name: 'HIIT Conditioning',     meta: '6 weeks · Intermediate · Cardio',   icon: Activity  },
  { name: 'Core & Stability',      meta: '3 weeks · All levels · Core focus', icon: Target    },
];

const heroStats = [
  { num: '10+',  label: 'Exercises' },
  { num: '30fps', label: 'Detection' },
  { num: '33',   label: 'Landmarks' },
  { num: '100%', label: 'Free to start' },
];

export default function HomePage() {
  return (
    <div className="home-page">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="home-hero">
        <div className="home-inner" style={{ width: '100%' }}>
          <div className="home-hero-grid">

            {/* Text block */}
            <div className="home-hero-text">
              <div className="home-hero-eyebrow">
                <span className="home-hero-eyebrow-dot" />
                AI-Powered Form Coaching
              </div>

              <h1 className="home-hero-h1">
                Train Right.<br />
                <em>Every Rep.</em>
              </h1>

              <p className="home-hero-body">
                GymFXR uses your camera to analyze exercise form in real time —
                giving live audio and visual cues so you build strength safely.
                No trainer required.
              </p>

              <div className="home-hero-ctas">
                <Link href="/camera" className="home-cta-primary">
                  Start Training <ArrowRight size={16} strokeWidth={2} />
                </Link>
                <Link href="/programs" className="home-cta-secondary">
                  Browse Programs
                </Link>
              </div>

              <div className="home-hero-stats">
                {heroStats.map(s => (
                  <div key={s.label} className="home-hero-stat">
                    <span className="home-hero-stat-num">{s.num}</span>
                    <span className="home-hero-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Camera UI mockup */}
            <div className="home-hero-visual">
              <div className="home-camera-mockup">
                {/* Screen */}
                <div className="home-camera-screen">
                  <div className="home-camera-live">
                    <span className="home-camera-live-dot" />
                    LIVE
                  </div>

                  {/* Skeleton pose illustration */}
                  <svg className="home-pose-svg" viewBox="0 0 200 280" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Skeleton lines */}
                    <line x1="100" y1="55"  x2="100" y2="110" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="100" y1="70"  x2="68"  y2="100" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="100" y1="70"  x2="132" y2="100" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="68"  y1="100" x2="56"  y2="138" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="132" y1="100" x2="144" y2="138" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="100" y1="110" x2="86"  y2="160" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="100" y1="110" x2="114" y2="160" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="86"  y1="160" x2="80"  y2="215" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="114" y1="160" x2="120" y2="215" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="80"  y1="215" x2="72"  y2="258" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />
                    <line x1="120" y1="215" x2="128" y2="258" stroke="rgba(213,255,95,0.35)" strokeWidth="1.5" />

                    {/* Joint dots */}
                    {([
                      [100, 45, 10], [100, 70, 5], [100, 110, 5],
                      [68, 100, 5], [132, 100, 5], [56, 138, 5], [144, 138, 5],
                      [86, 160, 5], [114, 160, 5], [80, 215, 5], [120, 215, 5],
                      [72, 258, 5], [128, 258, 5],
                    ] as [number, number, number][]).map(([x, y, r], i) => (
                      <circle key={i} cx={x} cy={y} r={r} fill="#D5FF5F" opacity={0.9} />
                    ))}

                    {/* Knee angle arc */}
                    <path d="M 80 215 A 28 28 0 0 0 108 215" stroke="#D5FF5F" strokeWidth="1.5" fill="none" opacity="0.7" />
                    <text x="90" y="244" fontSize="11" fill="#D5FF5F" textAnchor="middle" fontFamily="Poppins,sans-serif" fontWeight="700" opacity="0.9">142°</text>
                  </svg>

                  {/* Inline form score */}
                  <div style={{
                    position: 'absolute', bottom: 12, left: 12, right: 12,
                    background: 'rgba(0,0,0,0.65)', borderRadius: 10,
                    padding: '8px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Form Score</span>
                    <span style={{ fontSize: 13, color: '#D5FF5F', fontWeight: 700 }}>87 / 100</span>
                  </div>
                </div>

                {/* Stat pills row */}
                <div className="home-camera-stats">
                  <div className="home-camera-stat-pill lime-pill">
                    <span className="home-camera-pill-val">12</span>
                    <span className="home-camera-pill-label">Reps</span>
                  </div>
                  <div className="home-camera-stat-pill">
                    <span className="home-camera-pill-val">142°</span>
                    <span className="home-camera-pill-label">Angle</span>
                  </div>
                  <div className="home-camera-stat-pill">
                    <span className="home-camera-pill-val">DOWN</span>
                    <span className="home-camera-pill-label">Phase</span>
                  </div>
                </div>

                {/* Feedback cue */}
                <div style={{ padding: '0 14px 14px' }}>
                  <div style={{
                    background: 'rgba(213,255,95,0.1)',
                    border: '1px solid rgba(213,255,95,0.22)',
                    borderRadius: 10,
                    padding: '9px 13px',
                  }}>
                    <p style={{ fontSize: 12, color: '#D5FF5F', fontWeight: 600, margin: 0 }}>
                      ✓ Good depth — keep your chest up
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <section className="home-stats-strip">
        <div className="home-inner">
          <div className="home-stats-strip-grid">
            {heroStats.map(s => (
              <div key={s.label} className="home-stat-block">
                <span className="home-stat-block-num">{s.num}</span>
                <span className="home-stat-block-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="home-features">
        <div className="home-inner">
          <div className="home-section-header">
            <p className="home-section-eyebrow">Everything you need</p>
            <h2 className="home-section-h2">A complete fitness platform</h2>
            <p className="home-section-sub">
              From real-time form coaching to nutrition logging — one dark, fast interface for everything.
            </p>
          </div>

          <div className="home-features-grid">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="home-feature-card">
                <div className="home-feature-icon-wrap">
                  <Icon strokeWidth={1.5} />
                </div>
                <h3 className="home-feature-title">{title}</h3>
                <p className="home-feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="home-how">
        <div className="home-inner">
          <div className="home-section-header">
            <p className="home-section-eyebrow">Simple by design</p>
            <h2 className="home-section-h2">Up and running in 30 seconds</h2>
          </div>

          <div className="home-steps-grid">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="home-step">
                <div className="home-step-num">{num}</div>
                <div className="home-step-content">
                  <h3 className="home-step-title">{title}</h3>
                  <p className="home-step-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Programs preview ────────────────────────────────────────────── */}
      <section className="home-programs">
        <div className="home-inner">
          <div className="home-section-header">
            <p className="home-section-eyebrow">Structured training</p>
            <h2 className="home-section-h2">Follow a program, not guesswork</h2>
            <p className="home-section-sub">
              Coach-designed programs you can start any time. Track completion week by week.
            </p>
          </div>

          <div className="home-programs-grid">
            {programs.map(({ name, meta, icon: Icon }) => (
              <Link key={name} href="/programs" className="home-program-card">
                <div className="home-program-icon">
                  <Icon strokeWidth={1.5} />
                </div>
                <div className="home-program-info">
                  <p className="home-program-name">{name}</p>
                  <p className="home-program-meta">{meta}</p>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/programs" className="home-cta-secondary">
              View all programs
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="home-cta-section">
        <div className="home-inner">
          <div className="home-cta-card">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={28} strokeWidth={2} style={{ color: 'var(--text-on-lime)' }} />
              </div>
            </div>
            <h2 className="home-cta-headline">
              Your best reps start <em>now.</em>
            </h2>
            <p className="home-cta-sub">
              Free to start. No equipment needed. Just you, your camera, and GymFXR.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link href="/camera" className="home-cta-primary">
                Open Camera <ArrowRight size={16} strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="home-footer">
        <div className="home-inner">
          <div className="home-footer-inner">
            <span className="home-footer-brand">GymFXR</span>

            <nav className="home-footer-links">
              <Link href="/dashboard"  className="home-footer-link">Dashboard</Link>
              <Link href="/camera"     className="home-footer-link">Camera</Link>
              <Link href="/programs"   className="home-footer-link">Programs</Link>
              <Link href="/nutrition"  className="home-footer-link">Nutrition</Link>
              <Link href="/social"     className="home-footer-link">Social</Link>
              <Link href="/login"      className="home-footer-link">Login</Link>
            </nav>

            <p className="home-footer-copy">© 2025 GymFXR · David Lim</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
