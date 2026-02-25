import Link from 'next/link';

const featureCards = [
  {
    title: 'Nutrition',
    description:
      'Regular exercise can lead to enhanced cardiovascular health, stronger muscles and bones, improved flexibility, and increased endurance.'
  },
  {
    title: 'Calendar',
    description:
      'Exercise releases endorphins, often referred to as the feel-good hormones, which can elevate mood and reduce feelings of stress.'
  },
  {
    title: 'Social',
    description:
      'Regular physical activity improves blood circulation and oxygen delivery to the body, resulting in increased energy levels and reduced fatigue.'
  }
];

export default function HomePage() {
  return (
    <div className="landing-page">
      <section className="landing-hero full-bleed">
        <div className="landing-hero-overlay" />
        <div className="landing-hero-shape" />
        <div className="landing-hero-content">
          <h1>FormCRT</h1>
          <p>
            FormCRT believe that all exercises should be done with CRT form with optimized fitness programs,
            nutrition intake, and planning.
          </p>
          <Link href="/camera" className="landing-primary-btn">
            Get Started
          </Link>
        </div>
      </section>

      <section className="full-bleed landing-light-section">
        <div className="landing-section-inner">
          <h2>About FormCRT</h2>
          <p className="landing-section-intro">
            Use real-time camera detection to analyze exercise form and give live feedback. It helps users train safer
            and improve technique, with free/paid tiers plus meal planning, workout scheduling, and collaborating with
            friends.
          </p>

          <div className="landing-about-grid">
            <div className="landing-feature-list">
              {featureCards.map((feature) => (
                <article key={feature.title} className="landing-feature-card">
                  <span className="landing-feature-icon">✦</span>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="landing-gallery">
              <img
                src="https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=700&q=80"
                alt="Battle rope workout"
              />
              <img
                src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=700&q=80"
                alt="Gym interior"
              />
              <img
                src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=700&q=80"
                alt="Workout gear"
                className="tall"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="full-bleed landing-programs-section">
        <div className="landing-section-inner landing-programs-grid">
          <div className="landing-program-images">
            <img
              src="https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?auto=format&fit=crop&w=500&q=80"
              alt="Woman with medicine ball"
            />
            <img
              src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80"
              alt="Athlete in training"
            />
          </div>

          <div>
            <p className="landing-program-kicker">What are different workout programs?</p>
            <h2>Programs</h2>
            <p>
              Stronger version of yourself. We are dedicated to empowering you on this transformative journey with our
              state-of-the-art facilities, regardless of your fitness level or goals.
            </p>
            <Link href="/programs" className="landing-dark-btn">
              Explore Programs
            </Link>
          </div>
        </div>
      </section>

      <section className="full-bleed landing-footer-cta">
        <div className="landing-section-inner">
          <h3>Call Us Now</h3>
          <p>(+1) 519-000-0000</p>
        </div>
      </section>

      <footer className="full-bleed landing-footer-main">
        <div className="landing-section-inner landing-footer-grid">
          <div>
            <div className="landing-footer-logo">FormCRT</div>
            <p>© 2025 by David Lim</p>
            <p>davidlim5774@gmail.com</p>
          </div>

          <div>
            <h4>Quick Links</h4>
            <ul>
              <li>Home</li>
              <li>Camera</li>
              <li>Program</li>
              <li>Nutrition</li>
            </ul>
          </div>

          <div>
            <h4>Branches</h4>
            <ul>
              <li>Lorem</li>
              <li>Lorem</li>
              <li>Lorem</li>
              <li>Lorem</li>
            </ul>
          </div>

          <div>
            <h4>Lorem Ipsum</h4>
            <ul>
              <li>Lorem</li>
              <li>Lorem</li>
              <li>Lorem</li>
              <li>Lorem</li>
            </ul>
          </div>

          <div>
            <h4>Lorem Ipsum</h4>
            <ul>
              <li>Lorem</li>
              <li>Lorem</li>
              <li>Lorem</li>
              <li>Lorem</li>
            </ul>
          </div>
        </div>
        <p className="landing-footer-copy">© 2025 by David Lim All rights reserved.</p>
      </footer>
    </div>
  );
}
