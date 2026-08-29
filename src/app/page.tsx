import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Alante Velez — Full Stack Web Developer',
  description: 'I turn ideas into products that work. Custom web applications, SaaS platforms, and business automation.',
  keywords: ['full stack developer', 'Next.js developer', 'SaaS development', 'web applications', 'custom software'],
  authors: [{ name: 'Alante Velez' }],
  robots: { index: true, follow: true },
}

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        
        :root {
          --pink: #A96860;
          --pink-light: #C18078;
          --gold: #D4A574;
          --beige: #F5E6D3;
          --cream: #FAF3E8;
          --dark: #2A2420;
          --dark-light: #3D3630;
          --muted: #8B7D73;
          --border: rgba(169,104,96,0.2);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: var(--cream); color: var(--dark); font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; }

        nav { position: fixed; top: 0; left: 0; right: 0; padding: 24px 48px; display: flex; justify-content: space-between; align-items: center; z-index: 100; background: rgba(250,243,232,0.98); backdrop-filter: blur(8px); transition: all 0.3s; border-bottom: 1px solid var(--border); }
        
        .nav-logo { font-family: 'Playfair Display', serif; font-size: 1rem; color: var(--dark); letter-spacing: 0.02em; text-decoration: none; font-weight: 700; }
        .nav-logo-sub { font-family: 'DM Mono', monospace; font-size: 0.6rem; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; }
        
        .nav-links { display: flex; gap: 36px; }
        .nav-links a { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--muted); text-decoration: none; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
        .nav-links a:hover { color: var(--pink); }

        .nav-cta { background: var(--dark); color: var(--cream); padding: 12px 24px; font-family: 'DM Mono', monospace; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: all 0.2s; }
        .nav-cta:hover { background: var(--pink); }

        .hero { min-height: 100vh; display: grid; grid-template-columns: 0.7fr 1.3fr; align-items: center; padding: 140px 48px; position: relative; overflow: hidden; z-index: 2; gap: 40px; }
        
        .hero::before { content: ''; position: absolute; right: -5%; top: 50%; transform: translateY(-50%); width: 60%; height: 150%; background: url('/plante_shadow.jpg') center/cover no-repeat; pointer-events: none; opacity: 0.8; z-index: 1; }

        .hero-left { position: relative; z-index: 2; }
        .hero-photo { width: 100%; max-width: 420px; border-radius: 8px; overflow: hidden; box-shadow: 0 24px 48px rgba(0,0,0,0.08); }
        .hero-photo img { width: 100%; display: block; }

        .hero-right { position: relative; z-index: 3; max-width: 550px; }
        
        .hero-tag { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--pink); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 20px; font-weight: 500; }

        .hero-name { font-family: 'Playfair Display', serif; font-size: clamp(44px, 6vw, 72px); font-weight: 900; line-height: 1.15; margin-bottom: 24px; letter-spacing: -0.015em; color: var(--dark); }
        .hero-name em { font-style: italic; color: var(--pink); }

        .hero-desc { font-size: 1rem; line-height: 1.7; color: rgba(42,36,32,0.75); max-width: 480px; margin-bottom: 36px; }

        .hero-btns { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 40px; }
        
        .btn { display: inline-flex; align-items: center; gap: 10px; padding: 14px 28px; font-family: 'DM Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: all 0.25s; border: none; cursor: pointer; font-weight: 500; }
        
        .btn-primary { background: var(--pink); color: var(--cream); }
        .btn-primary:hover { background: var(--pink-light); transform: translateY(-2px); }

        .btn-secondary { background: transparent; color: var(--dark); border: 1.5px solid var(--muted); }
        .btn-secondary:hover { border-color: var(--pink); color: var(--pink); }

        .tech-ticker { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 12px 0; margin-top: 32px; }
        .ticker-label { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--muted); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 10px; font-weight: 500; }
        .ticker-items { font-family: 'DM Mono', monospace; font-size: 0.75rem; color: var(--muted); letter-spacing: 0.06em; display: flex; flex-wrap: wrap; gap: 20px; }

        section { padding: 100px 48px; position: relative; z-index: 2; }
        section.light { background: var(--cream); }
        section.featured { background: linear-gradient(135deg, rgba(245,230,211,0.5), rgba(250,243,232,0.5)); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        
        .section-label { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--pink); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 16px; font-weight: 500; }
        .section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; }
        .section-title { font-family: 'Playfair Display', serif; font-size: clamp(36px, 5vw, 56px); font-weight: 900; line-height: 1.1; letter-spacing: -0.015em; color: var(--dark); }
        .section-link { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--pink); letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; }

        .project-row { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; margin-bottom: 80px; }
        .project-row.reverse { direction: rtl; }
        .project-row.reverse > * { direction: ltr; }
        
        .project-image-large { width: 100%; aspect-ratio: 4/3; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .project-image-large img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
        .project-image-large:hover img { transform: scale(1.03); }

        .project-content { display: flex; flex-direction: column; gap: 16px; }
        .project-name { font-family: 'Playfair Display', serif; font-size: 1.3rem; font-weight: 700; margin-bottom: 6px; color: var(--dark); }
        .project-subtitle { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--pink); letter-spacing: 0.1em; margin-bottom: 14px; text-transform: uppercase; font-weight: 500; }
        .project-desc { font-size: 0.9rem; line-height: 1.6; color: rgba(42,36,32,0.7); margin-bottom: 18px; }

        .tech-stack { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .tech-badge { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--pink); background: rgba(169,104,96,0.08); padding: 6px 12px; border-radius: 3px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; }

        .project-link { display: inline-flex; align-items: center; gap: 8px; font-family: 'DM Mono', monospace; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pink); text-decoration: none; transition: gap 0.2s; font-weight: 500; }
        .project-link:hover { gap: 14px; }

        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; margin-bottom: 60px; }
        .stat-box { background: white; border: 1px solid var(--border); padding: 32px 28px; text-align: center; border-radius: 4px; }
        .stat-num { font-family: 'Playfair Display', serif; font-size: 2.8rem; font-weight: 900; color: var(--pink); line-height: 1; margin-bottom: 8px; }
        .stat-label { font-size: 0.85rem; line-height: 1.4; color: var(--muted); }

        .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2px; }
        .service-card { background: white; border: 1px solid var(--border); padding: 32px 28px; transition: all 0.3s; }
        .service-card:hover { background: rgba(169,104,96,0.03); border-color: var(--pink); }
        .service-icon { font-size: 2rem; margin-bottom: 14px; }
        .service-name { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; color: var(--dark); }
        .service-desc { font-size: 0.85rem; line-height: 1.6; color: rgba(42,36,32,0.65); }

        .process-section { background: rgba(250,243,232,0.8); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .process-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: start; margin-bottom: 60px; }
        .process-left { max-width: 400px; }
        .process-left h3 { font-family: 'Playfair Display', serif; font-size: clamp(32px, 4vw, 44px); font-weight: 900; line-height: 1.2; margin-bottom: 20px; color: var(--dark); }
        .process-left p { font-size: 0.95rem; line-height: 1.7; color: rgba(42,36,32,0.7); margin-bottom: 32px; }
        .process-steps { display: flex; flex-direction: column; gap: 2px; }
        .process-step { background: white; border: 1px solid var(--border); padding: 24px 28px; display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: start; }
        .process-circle { width: 40px; height: 40px; border-radius: 50%; background: var(--pink); color: white; display: flex; align-items: center; justify-content: center; font-family: 'DM Mono', monospace; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
        .process-content h4 { font-family: 'Playfair Display', serif; font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: var(--dark); }
        .process-content p { font-size: 0.85rem; line-height: 1.6; color: rgba(42,36,32,0.65); }

        .cta-block { text-align: center; padding: 80px 48px; }
        .cta-title { font-family: 'Playfair Display', serif; font-size: clamp(40px, 6vw, 56px); font-weight: 900; line-height: 1.15; margin-bottom: 20px; color: var(--dark); }
        .cta-subtitle { font-size: 1rem; color: rgba(42,36,32,0.7); margin-bottom: 40px; max-width: 520px; margin-left: auto; margin-right: auto; line-height: 1.7; }

        footer { border-top: 1px solid var(--border); padding: 32px 48px; display: flex; justify-content: space-between; align-items: center; background: var(--cream); }
        .footer-name { font-family: 'Playfair Display', serif; font-size: 0.95rem; color: var(--muted); font-weight: 500; }
        .footer-links { display: flex; gap: 28px; }
        .footer-links a { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--muted); text-decoration: none; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
        .footer-links a:hover { color: var(--pink); }

        @media (max-width: 768px) {
          nav { padding: 20px 24px; }
          .nav-links { display: none; }
          .nav-cta { padding: 10px 18px; font-size: 0.65rem; }
          .hero { grid-template-columns: 1fr; padding: 100px 24px 60px; gap: 40px; }
          .hero::before { display: none; }
          .hero-left { max-width: 100%; }
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .services-grid { grid-template-columns: 1fr; }
          .process-grid { grid-template-columns: 1fr; gap: 40px; }
          .project-row { grid-template-columns: 1fr; gap: 32px; }
          .project-row.reverse { direction: ltr; }
          section { padding: 70px 24px; }
          footer { flex-direction: column; gap: 20px; text-align: center; }
        }
      `}</style>

      <nav id="mainNav">
        <div>
          <div className="nav-logo">Alante Velez</div>
          <div className="nav-logo-sub">Full Stack Product Developer</div>
        </div>
        <div className="nav-links">
          <a href="#work">Work</a>
          <a href="#services">Services</a>
          <a href="#process">Process</a>
        </div>
        <a href="#hire" className="nav-cta">Start a Project</a>
      </nav>

      <section className="hero light">
        <div className="hero-left">
          <div className="hero-photo">
            <img src="/Alante.PNG" alt="Alante Velez" />
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-tag">Full Stack Product Development</div>
          <h1 className="hero-name">I turn ideas into <em>products that work.</em><br />Then I stay.</h1>
          <p className="hero-desc">I design, build, launch, and maintain custom web applications for businesses — from SaaS platforms and client portals to AI workflows, payments, and automation.</p>
          <div className="hero-btns">
            <a href="#hire" className="btn btn-primary">Start a Project →</a>
            <a href="#work" className="btn btn-secondary">View My Work →</a>
          </div>
          <div className="tech-ticker">
            <div className="ticker-label">Built with</div>
            <div className="ticker-items">
              Next.js · Supabase · Stripe · AI · Vercel · Resend · React · TypeScript
            </div>
          </div>
        </div>
      </section>

      <section id="work" className="featured">
        <div className="section-header">
          <div>
            <div className="section-label">Featured Projects</div>
            <h2 className="section-title">Real products.<br />Real impact.</h2>
          </div>
          <a href="#" className="section-link">View All Work →</a>
        </div>

        <div className="project-row">
          <div className="project-image-large">
            <img src="/planary.png" alt="Planary travel platform" />
          </div>
          <div className="project-content">
            <div className="project-name">Planary</div>
            <div className="project-subtitle">AI-Powered Travel Platform</div>
            <p className="project-desc">Custom travel planning platform with AI recommendations, interactive itineraries, Stripe payments, customer dashboard, and admin panel.</p>
            <div className="tech-stack">
              <span className="tech-badge">Next.js</span>
              <span className="tech-badge">Supabase</span>
              <span className="tech-badge">Stripe</span>
              <span className="tech-badge">AI</span>
            </div>
            <a href="https://planarytravel.com" target="_blank" className="project-link">View Live Site →</a>
          </div>
        </div>

        <div className="project-row reverse">
          <div className="project-image-large">
            <img src="/rising-sons.png" alt="Rising Sons Leadership Academy" />
          </div>
          <div className="project-content">
            <div className="project-name">Rising Sons Leadership Academy</div>
            <div className="project-subtitle">Custom Learning Management System</div>
            <p className="project-desc">Full-stack LMS with custom video player, per-student access control, progress tracking, PayPal payments, and Zoom integration.</p>
            <div className="tech-stack">
              <span className="tech-badge">Next.js</span>
              <span className="tech-badge">Supabase</span>
              <span className="tech-badge">PayPal</span>
              <span className="tech-badge">Zoom API</span>
            </div>
            <a href="https://risingsonsacademy.org" target="_blank" className="project-link">View Live Site →</a>
          </div>
        </div>

        <div className="project-row">
          <div className="project-image-large">
            <img src="/tramaine.png" alt="Tramaine Crawford coaching platform" />
          </div>
          <div className="project-content">
            <div className="project-name">Tramaine Crawford</div>
            <div className="project-subtitle">Professional Development Platform</div>
            <p className="project-desc">Coaching and consulting booking platform. Allows clients to schedule sessions, manage availability, and track coaching relationships.</p>
            <div className="tech-stack">
              <span className="tech-badge">Next.js</span>
              <span className="tech-badge">Supabase</span>
              <span className="tech-badge">Calendly</span>
            </div>
            <a href="https://tramainecrawford.com" target="_blank" className="project-link">View Live Site →</a>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-num">2+</div>
            <div className="stat-label">Live platforms in production</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">5+</div>
            <div className="stat-label">Years building independently</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">End to End</div>
            <div className="stat-label">From idea to launch and beyond</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">Ongoing</div>
            <div className="stat-label">Support, updates and partnership</div>
          </div>
        </div>
      </section>

      <section id="services" className="light">
        <div className="section-header">
          <div>
            <div className="section-label">What I Build</div>
            <h2 className="section-title">Solutions built<br />for your business.</h2>
          </div>
          <a href="#" className="section-link">All Services →</a>
        </div>
        <div className="services-grid">
          <div className="service-card">
            <div className="service-icon">⚡</div>
            <div className="service-name">AI Integration</div>
            <p className="service-desc">Custom Claude API integrations, prompt engineering, and AI powered workflows built for real products.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">🔨</div>
            <div className="service-name">Next.js Development</div>
            <p className="service-desc">Full stack apps and websites using Next.js with server side rendering, authentication, and Vercel deployment.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">💳</div>
            <div className="service-name">Stripe Payments</div>
            <p className="service-desc">One time checkout, subscriptions, webhooks, and billing systems that work reliably in production.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">🗄️</div>
            <div className="service-name">Supabase Backend</div>
            <p className="service-desc">Database design, Row Level Security policies, authentication, and storage for modern web apps.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">📧</div>
            <div className="service-name">Email Automation</div>
            <p className="service-desc">Transactional email systems with Resend including dynamic templates and event triggered delivery.</p>
          </div>
          <div className="service-card">
            <div className="service-icon">🚀</div>
            <div className="service-name">SaaS Starter Builds</div>
            <p className="service-desc">Production ready SaaS foundations with auth, payments, and database wired up and deployed from day one.</p>
          </div>
        </div>
      </section>

      <section id="process" className="process-section">
        <div className="section-label">My Process</div>
        <h2 className="section-title">A clear process.<br />A better experience.</h2>
        
        <div className="process-grid">
          <div className="process-left">
            <h3>I keep your project on track from day one to long after launch.</h3>
            <p>Working with me means having a developer who understands your business, ships on time, and stays involved after launch to support growth.</p>
            <a href="#hire" className="btn btn-primary" style={{marginTop: '20px'}}>Start Your Project →</a>
          </div>
          <div>
            <div className="process-steps">
              <div className="process-step">
                <div className="process-circle">01</div>
                <div className="process-content">
                  <h4>Discovery</h4>
                  <p>We talk through your ideas, goals, and requirements. I review before we speak.</p>
                </div>
              </div>
              <div className="process-step">
                <div className="process-circle">02</div>
                <div className="process-content">
                  <h4>Proposal</h4>
                  <p>You get a clear timeline, fixed deliverables list, and terms to get started.</p>
                </div>
              </div>
              <div className="process-step">
                <div className="process-circle">03</div>
                <div className="process-content">
                  <h4>Build</h4>
                  <p>I design, develop, and test your product with you. Regular updates throughout.</p>
                </div>
              </div>
              <div className="process-step">
                <div className="process-circle">04</div>
                <div className="process-content">
                  <h4>Launch and Support</h4>
                  <p>We launch and I stay involved for updates and growth.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="hire" className="light">
        <div className="cta-block">
          <h2 className="cta-title">Let's build something<br /><em style={{color: 'var(--pink)', fontStyle: 'italic'}}>that lasts.</em></h2>
          <p className="cta-subtitle">Have an idea but unsure what you need? That's okay. Tell me what you're trying to accomplish and I'll help determine the technical approach.</p>
          <a href="/intake" className="btn btn-primary" style={{marginRight: '12px'}}>Start the Intake Form →</a>
        </div>
      </section>

      <footer>
        <div className="footer-name">© 2025 Alante Velez. All rights reserved.</div>
        <div className="footer-links">
          <a href="https://planarytravel.com" target="_blank">Planary</a>
          <a href="https://risingsonsacademy.org" target="_blank">Rising Sons</a>
          <a href="https://tramainecrawford.com" target="_blank">Tramaine Crawford</a>
          <a href="/intake">Start a Project</a>
        </div>
      </footer>

      <script dangerouslySetInnerHTML={{__html: `
        window.addEventListener('scroll', () => {
          const nav = document.getElementById('mainNav');
          if (window.scrollY > 60) {
            nav.style.background = 'rgba(250,243,232,0.95)';
          } else {
            nav.style.background = 'rgba(250,243,232,0.98)';
          }
        });
      `}} />
    </>
  )
}