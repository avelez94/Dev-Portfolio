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
          --pink: #E97B8D;
          --pink-light: #F0A4B0;
          --gold: #D4A574;
          --beige: #F5E6D3;
          --cream: #FAF3E8;
          --dark: #1A1410;
          --dark-mid: #2D2420;
          --muted: #8B7D73;
          --border: rgba(233,123,141,0.15);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: var(--dark); color: var(--cream); font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; }

        nav { position: fixed; top: 0; left: 0; right: 0; padding: 24px 48px; display: flex; justify-content: space-between; align-items: center; z-index: 100; transition: background 0.4s, padding 0.4s; }
        nav.scrolled { background: rgba(26,20,16,0.95); backdrop-filter: blur(16px); padding: 16px 48px; border-bottom: 1px solid var(--border); }
        
        .nav-logo { font-family: 'Playfair Display', serif; font-size: 1rem; color: var(--cream); letter-spacing: 0.02em; text-decoration: none; }
        .nav-logo-sub { font-family: 'DM Mono', monospace; font-size: 0.6rem; color: var(--muted); letter-spacing: 0.15em; text-transform: uppercase; }
        
        .nav-links { display: flex; gap: 32px; }
        .nav-links a { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--muted); text-decoration: none; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
        .nav-links a:hover { color: var(--pink); }

        .nav-cta { background: var(--pink); color: var(--cream); padding: 12px 24px; font-family: 'DM Mono', monospace; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: background 0.2s; }
        .nav-cta:hover { background: var(--pink-light); }

        .hero { min-height: 100vh; display: flex; align-items: center; padding: 140px 48px 80px; position: relative; overflow: hidden; z-index: 2; }
        .hero::before { content: ''; position: absolute; top: 0; right: 0; width: 50%; height: 100%; background: linear-gradient(135deg, rgba(233,123,141,0.08), rgba(212,165,116,0.08)); pointer-events: none; }

        .hero-content { position: relative; z-index: 2; max-width: 600px; }
        
        .hero-tag { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--pink); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; }
        .hero-tag::before { content: ''; width: 24px; height: 1px; background: var(--pink); }

        .hero-name { font-family: 'Playfair Display', serif; font-size: clamp(48px, 7vw, 80px); font-weight: 900; line-height: 1.1; margin-bottom: 28px; letter-spacing: -0.01em; }
        .hero-name em { font-style: italic; color: var(--pink); }

        .hero-desc { font-size: 1.05rem; line-height: 1.7; color: rgba(250,243,232,0.7); max-width: 500px; margin-bottom: 40px; }

        .hero-btns { display: flex; gap: 16px; flex-wrap: wrap; }
        
        .btn { display: inline-flex; align-items: center; gap: 12px; padding: 14px 28px; font-family: 'DM Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: all 0.25s; }
        
        .btn-primary { background: var(--pink); color: var(--cream); }
        .btn-primary:hover { background: var(--pink-light); transform: translateY(-2px); }

        .btn-ghost { background: transparent; color: var(--cream); border: 1px solid var(--border); }
        .btn-ghost:hover { border-color: var(--pink); color: var(--pink); }

        .tech-ticker { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 16px 0; margin-top: 60px; background: rgba(233,123,141,0.03); }
        .ticker-label { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--muted); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px; }
        .ticker-items { font-family: 'DM Mono', monospace; font-size: 0.75rem; color: rgba(250,243,232,0.5); letter-spacing: 0.08em; display: flex; flex-wrap: wrap; gap: 24px; }

        section { padding: 100px 48px; position: relative; z-index: 2; }
        
        .section-label { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--pink); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 16px; }
        .section-title { font-family: 'Playfair Display', serif; font-size: clamp(36px, 5vw, 56px); font-weight: 700; line-height: 1.1; margin-bottom: 64px; }

        .projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 24px; }
        
        .project-card { background: var(--dark-mid); border: 1px solid var(--border); padding: 36px; position: relative; overflow: hidden; transition: all 0.3s; }
        .project-card:hover { background: rgba(233,123,141,0.05); border-color: var(--pink); }

        .project-image { width: 100%; height: 240px; background: linear-gradient(135deg, rgba(212,165,116,0.1), rgba(233,123,141,0.1)); border-radius: 4px; margin-bottom: 28px; display: flex; align-items: center; justify-content: center; font-size: 3rem; }

        .project-icon { font-size: 2.5rem; margin-bottom: 16px; }
        .project-name { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 700; margin-bottom: 8px; }
        .project-subtitle { font-family: 'DM Mono', monospace; font-size: 0.75rem; color: var(--pink); letter-spacing: 0.08em; margin-bottom: 16px; text-transform: uppercase; }
        .project-desc { font-size: 0.95rem; line-height: 1.6; color: rgba(250,243,232,0.65); margin-bottom: 24px; }

        .project-link { display: inline-flex; align-items: center; gap: 10px; font-family: 'DM Mono', monospace; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pink); text-decoration: none; transition: gap 0.2s; }
        .project-link:hover { gap: 16px; }

        .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2px; }
        .service-card { background: var(--dark-mid); padding: 36px 32px; border: 1px solid var(--border); position: relative; transition: all 0.3s; }
        .service-card:hover { background: rgba(233,123,141,0.05); border-color: var(--pink); }

        .service-icon { font-size: 1.8rem; margin-bottom: 16px; }
        .service-name { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
        .service-desc { font-size: 0.85rem; line-height: 1.6; color: rgba(250,243,232,0.6); }

        .process-section { background: rgba(233,123,141,0.05); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .process-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-bottom: 64px; }
        .process-step { background: var(--dark-mid); padding: 36px 28px; border: 1px solid var(--border); }
        .process-num { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--pink); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 12px; }
        .process-title { font-family: 'Playfair Display', serif; font-size: 1rem; font-weight: 700; margin-bottom: 8px; }
        .process-desc { font-size: 0.85rem; line-height: 1.6; color: rgba(250,243,232,0.6); }

        .cta-block { text-align: center; }
        .cta-title { font-family: 'Playfair Display', serif; font-size: clamp(36px, 5vw, 52px); font-weight: 700; line-height: 1.2; margin-bottom: 20px; }
        .cta-subtitle { font-size: 1rem; color: rgba(250,243,232,0.6); margin-bottom: 40px; max-width: 500px; margin-left: auto; margin-right: auto; }

        footer { border-top: 1px solid var(--border); padding: 32px 48px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2; }
        .footer-name { font-family: 'Playfair Display', serif; font-size: 0.95rem; color: var(--muted); }
        .footer-links { display: flex; gap: 28px; }
        .footer-links a { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--muted); text-decoration: none; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
        .footer-links a:hover { color: var(--pink); }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
          nav { padding: 20px 24px; }
          .nav-links { display: none; }
          .nav-cta { display: none; }
          .hero { padding: 100px 24px 60px; }
          section { padding: 70px 24px; }
          .projects-grid { grid-template-columns: 1fr; }
          .services-grid { grid-template-columns: 1fr; }
          .process-steps { grid-template-columns: 1fr; }
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
          <a href="#about">About</a>
        </div>
        <a href="#hire" className="nav-cta">Start a Project</a>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-tag">Full Stack Product Development</div>
          <h1 className="hero-name">I turn ideas into <em>products that work.</em><br />Then I stay.</h1>
          <p className="hero-desc">I design, build, launch, and maintain custom web applications for businesses — from SaaS platforms and client portals to AI workflows, payments, and automation.</p>
          <div className="hero-btns">
            <a href="#hire" className="btn btn-primary">Start a Project <span>→</span></a>
            <a href="#work" className="btn btn-ghost">View My Work <span>→</span></a>
          </div>
          <div className="tech-ticker">
            <div className="ticker-label">Built with</div>
            <div className="ticker-items">
              Next.js • Supabase • Stripe • AI • Vercel • Resend • React • TypeScript
            </div>
          </div>
        </div>
      </section>

      <section id="work">
        <div className="section-label">Featured Projects</div>
        <h2 className="section-title">Real products. Real impact.</h2>
        <div className="projects-grid">
          <div className="project-card">
            <div className="project-image">✈️</div>
            <div className="project-name">Planary</div>
            <div className="project-subtitle">AI-Powered Travel Platform</div>
            <p className="project-desc">Custom travel planning platform with AI recommendations, interactive itineraries, Stripe payments, customer dashboard, and admin panel. Generates and delivers fully custom travel guides automatically.</p>
            <a href="https://planarytravel.com" target="_blank" className="project-link">View Live Site →</a>
          </div>

          <div className="project-card">
            <div className="project-image">🎓</div>
            <div className="project-name">Rising Sons Leadership Academy</div>
            <div className="project-subtitle">Custom Learning Management System</div>
            <p className="project-desc">Full-stack LMS with custom video player, per-student access control, progress tracking, PayPal payments, Zoom integration, interactive games, and student portals. Built to handle their entire customer journey.</p>
            <a href="https://risingsonsacademy.org" target="_blank" className="project-link">View Live Site →</a>
          </div>

          <div className="project-card">
            <div className="project-image">💼</div>
            <div className="project-name">Tramaine Crawford</div>
            <div className="project-subtitle">Professional Development Platform</div>
            <p className="project-desc">Coaching and consulting booking platform for professional development. Allows clients to schedule sessions, manage availability, and track coaching relationships in one place.</p>
            <a href="https://tramainecrawford.com" target="_blank" className="project-link">View Live Site →</a>
          </div>
        </div>
      </section>

      <section id="services">
        <div className="section-label">What I Build</div>
        <h2 className="section-title">Solutions built for your business.</h2>
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
        <div className="section-label">Your Process</div>
        <h2 className="section-title">How we work together.</h2>
        <div className="process-steps">
          <div className="process-step">
            <div className="process-num">Step 01</div>
            <div className="process-title">Intake Form</div>
            <p className="process-desc">Tell me about your project. Takes 3 minutes. You'll book a discovery call right after.</p>
          </div>
          <div className="process-step">
            <div className="process-num">Step 02</div>
            <div className="process-title">Discovery Call</div>
            <p className="process-desc">20 minute conversation to confirm scope, timeline, and fit. I review before we speak.</p>
          </div>
          <div className="process-step">
            <div className="process-num">Step 03</div>
            <div className="process-title">Proposal & Build</div>
            <p className="process-desc">Signed SOW, clear deliverables, 50% deposit, and we start building your product.</p>
          </div>
        </div>

        <div className="cta-block" id="hire">
          <h2 className="cta-title">Let's build something<br /><em style={{color: 'var(--pink)', fontStyle: 'italic'}}>that lasts.</em></h2>
          <p className="cta-subtitle">Have an idea but unsure what you need? That's okay. Tell me what you're trying to accomplish and I'll help determine the technical approach.</p>
          <a href="/intake" className="btn btn-primary" style={{marginRight: '12px'}}>Start the Intake Form →</a>
        </div>
      </section>

      <footer>
        <div className="footer-name">Alante Velez</div>
        <div className="footer-links">
          <a href="https://planarytravel.com" target="_blank">Planary</a>
          <a href="https://risingsonsacademy.org" target="_blank">Rising Sons</a>
          <a href="https://tramainecrawford.com" target="_blank">Tramaine Crawford</a>
          <a href="/intake">Start a Project</a>
        </div>
      </footer>

      <script dangerouslySetInnerHTML={{__html: `
        window.addEventListener('scroll', () => {
          document.getElementById('mainNav').classList.toggle('scrolled', window.scrollY > 60);
        });
      `}} />
    </>
  )
}
