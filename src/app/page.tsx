import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Alante Velez — Full Stack Web Developer',
  description: 'Full stack web developer specializing in Next.js, Supabase, Stripe, and AI integrations. Building production ready web applications from the ground up.',
  keywords: ['full stack developer', 'Next.js developer', 'web developer for hire', 'Supabase', 'Stripe integration', 'AI integration', 'freelance web developer'],
  authors: [{ name: 'Alante Velez' }],
  openGraph: {
    title: 'Alante Velez — Full Stack Web Developer',
    description: 'Full stack web developer specializing in Next.js, Supabase, Stripe, and AI integrations.',
    url: 'https://yourdomain.com',
    siteName: 'Alante Velez',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Alante Velez — Full Stack Web Developer' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alante Velez — Full Stack Web Developer',
    description: 'Full stack web developer specializing in Next.js, Supabase, Stripe, and AI integrations.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
}

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        :root {
          --terracotta: #C4704A; --terracotta-light: #d4855f;
          --cream: #FAF6F0; --espresso: #2C1A0E;
          --espresso-mid: #3d2a1a; --muted: #8a7060;
          --border: rgba(196,112,74,0.2);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: var(--espresso); color: var(--cream); font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; }
        #particleCanvas { position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.5; }
        body::before { content: ''; position: fixed; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E"); opacity: 0.03; pointer-events: none; z-index: 1; }
        nav { position: fixed; top: 0; left: 0; right: 0; padding: 28px 48px; display: flex; justify-content: space-between; align-items: center; z-index: 100; transition: background 0.4s, padding 0.4s; }
        nav.scrolled { background: rgba(44,26,14,0.92); backdrop-filter: blur(16px); padding: 18px 48px; border-bottom: 1px solid var(--border); }
        .nav-logo { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: var(--cream); letter-spacing: 0.02em; opacity: 0; animation: fadeUp 0.8s 0.2s forwards; text-decoration: none; }
        .nav-links { display: flex; gap: 36px; }
        .nav-links a { font-family: 'DM Mono', monospace; font-size: 0.72rem; color: var(--muted); text-decoration: none; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; opacity: 0; animation: fadeUp 0.8s forwards; position: relative; }
        .nav-links a::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 1px; background: var(--terracotta); transition: width 0.3s; }
        .nav-links a:hover::after { width: 100%; }
        .nav-links a:nth-child(1) { animation-delay: 0.3s; }
        .nav-links a:nth-child(2) { animation-delay: 0.4s; }
        .nav-links a:nth-child(3) { animation-delay: 0.5s; }
        .nav-links a:nth-child(4) { animation-delay: 0.6s; }
        .nav-links a:nth-child(5) { animation-delay: 0.7s; }
        .nav-links a:hover { color: var(--cream); }
        .hero { min-height: 100vh; display: flex; align-items: center; padding: 120px 48px 80px; position: relative; overflow: hidden; z-index: 2; }
        .hero-bg-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: 'Playfair Display', serif; font-size: clamp(100px, 18vw, 240px); font-weight: 900; color: transparent; -webkit-text-stroke: 1px rgba(196,112,74,0.07); white-space: nowrap; pointer-events: none; user-select: none; letter-spacing: -0.02em; transition: transform 0.1s ease-out; }
        .hero-content { position: relative; z-index: 2; max-width: 820px; }
        .hero-tag { display: inline-flex; align-items: center; gap: 10px; font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--terracotta); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 28px; opacity: 0; animation: fadeUp 0.9s 0.4s forwards; }
        .hero-tag::before { content: ''; width: 32px; height: 1px; background: var(--terracotta); }
        .hero-name { font-family: 'Playfair Display', serif; font-size: clamp(52px, 8vw, 96px); font-weight: 900; line-height: 0.95; letter-spacing: -0.02em; margin-bottom: 32px; opacity: 0; animation: fadeUp 0.9s 0.55s forwards; }
        .hero-name em { font-style: italic; color: var(--terracotta); }
        .typewriter-wrap { font-family: 'DM Mono', monospace; font-size: 0.85rem; color: var(--muted); letter-spacing: 0.08em; margin-bottom: 28px; opacity: 0; animation: fadeUp 0.9s 0.65s forwards; display: flex; align-items: center; gap: 8px; }
        .typewriter-prefix { color: var(--terracotta); }
        #typewriterText { color: var(--cream); }
        .cursor-blink { display: inline-block; width: 2px; height: 14px; background: var(--terracotta); animation: blink 0.8s infinite; vertical-align: middle; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .hero-desc { font-size: 1.05rem; line-height: 1.7; color: rgba(250,246,240,0.6); max-width: 520px; margin-bottom: 48px; font-weight: 300; opacity: 0; animation: fadeUp 0.9s 0.7s forwards; }
        .hero-btns { display: flex; gap: 16px; flex-wrap: wrap; opacity: 0; animation: fadeUp 0.9s 0.85s forwards; }
        .hero-cta { display: inline-flex; align-items: center; gap: 14px; background: var(--terracotta); color: var(--cream); padding: 16px 32px; font-family: 'DM Mono', monospace; font-size: 0.78rem; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: background 0.25s, transform 0.25s, box-shadow 0.25s; position: relative; overflow: hidden; }
        .hero-cta::before { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.08); transform: translateX(-100%); transition: transform 0.3s; }
        .hero-cta:hover::before { transform: translateX(0); }
        .hero-cta:hover { background: var(--terracotta-light); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(196,112,74,0.3); }
        .hero-cta-ghost { display: inline-flex; align-items: center; gap: 14px; background: transparent; color: var(--cream); padding: 16px 32px; border: 1px solid var(--border); font-family: 'DM Mono', monospace; font-size: 0.78rem; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: border-color 0.25s, color 0.25s, transform 0.25s; }
        .hero-cta-ghost:hover { border-color: var(--terracotta); color: var(--terracotta); transform: translateY(-2px); }
        .hero-scroll { position: absolute; bottom: 40px; right: 48px; font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--muted); letter-spacing: 0.15em; text-transform: uppercase; writing-mode: vertical-rl; display: flex; align-items: center; gap: 12px; opacity: 0; animation: fadeUp 1s 1.2s forwards; }
        .hero-scroll::after { content: ''; width: 1px; height: 48px; background: var(--terracotta); animation: lineGrow 1.5s 1.5s ease forwards; transform-origin: top; transform: scaleY(0); }
        @keyframes lineGrow { to { transform: scaleY(1); } }
        .marquee-wrap { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 16px 0; overflow: hidden; background: rgba(196,112,74,0.04); position: relative; z-index: 2; }
        .marquee-track { display: flex; animation: marqueeScroll 22s linear infinite; width: max-content; }
        .marquee-track:hover { animation-play-state: paused; }
        @keyframes marqueeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-item { display: flex; align-items: center; gap: 28px; padding: 0 28px; white-space: nowrap; font-family: 'DM Mono', monospace; font-size: 0.75rem; color: rgba(250,246,240,0.35); letter-spacing: 0.08em; }
        .marquee-sep { color: var(--terracotta); opacity: 0.4; }
        section { padding: 100px 48px; position: relative; z-index: 2; }
        .section-label { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--terracotta); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
        .section-label::before { content: ''; width: 24px; height: 1px; background: var(--terracotta); }
        .section-title { font-family: 'Playfair Display', serif; font-size: clamp(36px, 5vw, 56px); font-weight: 700; line-height: 1.1; margin-bottom: 64px; letter-spacing: -0.01em; }
        .projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 2px; }
        .project-card { background: var(--espresso-mid); padding: 48px; position: relative; overflow: hidden; opacity: 0; transform: translateY(32px); transition: background 0.3s, opacity 0.7s, transform 0.7s, box-shadow 0.3s; }
        .project-card.visible { opacity: 1; transform: translateY(0); }
        .project-card:hover { background: #4a3220; }
        .project-card::before { content: ''; position: absolute; top: 0; left: 0; width: 3px; height: 0; background: var(--terracotta); transition: height 0.5s ease; }
        .project-card:hover::before { height: 100%; }
        .project-num { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--terracotta); letter-spacing: 0.15em; margin-bottom: 24px; opacity: 0.7; }
        .project-title { font-family: 'Playfair Display', serif; font-size: 1.9rem; font-weight: 700; margin-bottom: 16px; line-height: 1.2; transition: color 0.2s; }
        .project-card:hover .project-title { color: var(--terracotta-light); }
        .project-desc { font-size: 0.9rem; line-height: 1.7; color: rgba(250,246,240,0.55); margin-bottom: 28px; }
        .project-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; }
        .tag { font-family: 'DM Mono', monospace; font-size: 0.65rem; letter-spacing: 0.08em; padding: 5px 12px; border: 1px solid var(--border); color: var(--muted); text-transform: uppercase; }
        .project-link { display: inline-flex; align-items: center; gap: 10px; font-family: 'DM Mono', monospace; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--terracotta); text-decoration: none; transition: gap 0.25s; }
        .project-link:hover { gap: 18px; }
        .demos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2px; }
        .demo-card { background: var(--espresso-mid); position: relative; overflow: hidden; opacity: 0; transform: translateY(24px); transition: opacity 0.6s, transform 0.6s, background 0.3s; }
        .demo-card.visible { opacity: 1; transform: translateY(0); }
        .demo-card:hover { background: #4a3220; }
        .demo-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; transform: scaleX(0); transition: transform 0.4s; }
        .demo-card:hover::before { transform: scaleX(1); }
        .demo-card.teal::before { background: linear-gradient(90deg, #4ecdc4, #2aa89e); }
        .demo-card.purple::before { background: linear-gradient(90deg, #8b5cf6, #ec4899); }
        .demo-card.emerald::before { background: linear-gradient(90deg, #34d399, #059669); }
        .demo-card.orange::before { background: linear-gradient(90deg, #ff6600, #ff8533); }
        .demo-card.red::before { background: linear-gradient(90deg, #c0392b, #e74c3c); }
        .demo-card.green::before { background: linear-gradient(90deg, #4ade80, #22c55e); }
        .demo-preview { height: 160px; display: flex; align-items: center; justify-content: center; font-size: 3.5rem; border-bottom: 1px solid var(--border); position: relative; overflow: hidden; }
        .demo-card.teal .demo-preview { background: linear-gradient(135deg, #050d1a, #0d1f35); }
        .demo-card.purple .demo-preview { background: linear-gradient(135deg, #0a0414, #17102a); }
        .demo-card.emerald .demo-preview { background: linear-gradient(135deg, #0f1117, #161b27); }
        .demo-card.orange .demo-preview { background: linear-gradient(135deg, #0c0c0c, #1c1c1c); }
        .demo-card.red .demo-preview { background: linear-gradient(135deg, #1a0a00, #2c1a0e); }
        .demo-card.green .demo-preview { background: linear-gradient(135deg, #050a05, #0d170d); }
        .demo-label { position: absolute; top: 12px; right: 12px; font-family: 'DM Mono', monospace; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); }
        .demo-info { padding: 24px 28px 28px; }
        .demo-num { font-family: 'DM Mono', monospace; font-size: 0.6rem; color: var(--terracotta); letter-spacing: 0.15em; margin-bottom: 8px; opacity: 0.7; }
        .demo-name { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
        .demo-desc { font-size: 0.8rem; line-height: 1.6; color: rgba(250,246,240,0.5); margin-bottom: 20px; }
        .demo-link { display: inline-flex; align-items: center; gap: 8px; font-family: 'DM Mono', monospace; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--terracotta); text-decoration: none; transition: gap 0.2s; }
        .demo-link:hover { gap: 14px; }
        .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2px; }
        .service-card { background: var(--espresso-mid); padding: 36px 32px; opacity: 0; transform: translateY(20px); transition: opacity 0.6s, transform 0.6s, background 0.3s; position: relative; overflow: hidden; }
        .service-card.visible { opacity: 1; transform: translateY(0); }
        .service-card:hover { background: #4a3220; }
        .service-card::before { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--terracotta), transparent); transform: scaleX(0); transition: transform 0.4s; }
        .service-card:hover::before { transform: scaleX(1); }
        .service-icon { font-size: 1.4rem; margin-bottom: 18px; display: block; }
        .service-name { font-family: 'Playfair Display', serif; font-size: 1.15rem; font-weight: 700; margin-bottom: 10px; }
        .service-desc { font-size: 0.83rem; line-height: 1.6; color: rgba(250,246,240,0.5); }
        .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
        .about-left { display: flex; flex-direction: column; gap: 32px; }
        .about-photo-wrap { position: relative; width: 100%; max-width: 420px; border-radius: 4px; overflow: hidden; }
        .about-photo-wrap img { width: 100%; display: block; filter: grayscale(20%) contrast(1.05); transition: filter 0.4s; }
        .about-photo-wrap:hover img { filter: grayscale(0%) contrast(1); }
        .about-photo-wrap::before { content: ''; position: absolute; inset: 0; border: 2px solid var(--terracotta); opacity: 0; transition: opacity 0.4s; z-index: 1; pointer-events: none; }
        .about-photo-wrap:hover::before { opacity: 0.4; }
        .about-photo-wrap::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 40%; background: linear-gradient(to top, rgba(44,26,14,0.6), transparent); pointer-events: none; }
        .about-edu { display: flex; flex-direction: column; gap: 10px; padding: 24px 28px; background: var(--espresso-mid); border-left: 3px solid var(--terracotta); }
        .edu-item { display: flex; flex-direction: column; gap: 3px; }
        .edu-degree { font-size: 0.88rem; font-weight: 500; color: var(--cream); }
        .edu-school { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--muted); letter-spacing: 0.06em; }
        .edu-divider { height: 1px; background: var(--border); }
        .about-text { font-size: 1rem; line-height: 1.8; color: rgba(250,246,240,0.65); }
        .about-text p { margin-bottom: 20px; }
        .about-text strong { color: var(--cream); font-weight: 500; }
        .about-right { display: flex; flex-direction: column; gap: 2px; }
        .about-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 2px; }
        .stat-box { background: var(--espresso-mid); padding: 32px 28px; opacity: 0; transform: scale(0.95); transition: opacity 0.5s, transform 0.5s, background 0.3s; }
        .stat-box.visible { opacity: 1; transform: scale(1); }
        .stat-box:hover { background: #4a3220; }
        .stat-num { font-family: 'Playfair Display', serif; font-size: 3rem; font-weight: 900; color: var(--terracotta); line-height: 1; margin-bottom: 8px; }
        .stat-label { font-size: 0.8rem; color: var(--muted); line-height: 1.4; }
        .work-with-me { padding: 100px 48px; position: relative; z-index: 2; border-top: 1px solid var(--border); }
        .rates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 2px; margin-bottom: 64px; }
        .rate-card { background: var(--espresso-mid); padding: 32px 28px; position: relative; overflow: hidden; opacity: 0; transform: translateY(20px); transition: opacity 0.6s, transform 0.6s, background 0.3s; }
        .rate-card.visible { opacity: 1; transform: translateY(0); }
        .rate-card:hover { background: #4a3220; }
        .rate-card::before { content: ''; position: absolute; top: 0; left: 0; width: 3px; height: 0; background: var(--terracotta); transition: height 0.4s ease; }
        .rate-card:hover::before { height: 100%; }
        .rate-name { font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 700; margin-bottom: 10px; }
        .rate-price { font-family: 'DM Mono', monospace; font-size: 0.85rem; color: var(--terracotta); letter-spacing: 0.06em; margin-bottom: 10px; }
        .rate-desc { font-size: 0.8rem; line-height: 1.6; color: rgba(250,246,240,0.45); }
        .process-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-bottom: 64px; }
        .process-step { background: var(--espresso-mid); padding: 36px 32px; position: relative; opacity: 0; transform: translateY(20px); transition: opacity 0.6s, transform 0.6s, scale 0.25s, background 0.25s, box-shadow 0.25s; cursor: default; }
        .process-step.visible { opacity: 1; transform: translateY(0); }
        .process-step.visible:hover { scale: 1.04; background: #4a3220; box-shadow: 0 16px 48px rgba(0,0,0,0.3); z-index: 2; }
        .process-step::after { content: ''; position: absolute; top: 50%; right: -1px; width: 1px; height: 40%; background: var(--border); transform: translateY(-50%); }
        .process-step:last-child::after { display: none; }
        .process-num { font-family: 'DM Mono', monospace; font-size: 0.62rem; color: var(--terracotta); letter-spacing: 0.18em; margin-bottom: 16px; opacity: 0.7; }
        .process-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; margin-bottom: 10px; }
        .process-desc { font-size: 0.82rem; line-height: 1.65; color: rgba(250,246,240,0.48); }
        .cta-section { text-align: center; padding: 120px 48px; position: relative; overflow: hidden; z-index: 2; }
        .cta-section::before { content: 'BUILD'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: 'Playfair Display', serif; font-size: clamp(120px, 22vw, 300px); font-weight: 900; color: transparent; -webkit-text-stroke: 1px rgba(196,112,74,0.05); pointer-events: none; white-space: nowrap; }
        .cta-section .section-label { justify-content: center; }
        .cta-section .section-label::before { display: none; }
        .cta-section .section-title { margin-bottom: 20px; }
        .cta-subtitle { color: rgba(250,246,240,0.5); font-size: 1rem; margin-bottom: 48px; max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.7; }
        .cta-btn { display: inline-flex; align-items: center; gap: 14px; background: transparent; border: 1px solid var(--terracotta); color: var(--cream); padding: 18px 40px; font-family: 'DM Mono', monospace; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; position: relative; z-index: 2; overflow: hidden; transition: color 0.3s, transform 0.25s; }
        .cta-btn::before { content: ''; position: absolute; inset: 0; background: var(--terracotta); transform: translateY(100%); transition: transform 0.35s cubic-bezier(0.76, 0, 0.24, 1); z-index: -1; }
        .cta-btn:hover::before { transform: translateY(0); }
        .cta-btn:hover { transform: translateY(-2px); }
        footer { border-top: 1px solid var(--border); padding: 32px 48px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2; }
        .footer-name { font-family: 'Playfair Display', serif; font-size: 0.95rem; color: var(--muted); }
        .footer-links { display: flex; gap: 28px; }
        .footer-links a { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--muted); text-decoration: none; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
        .footer-links a:hover { color: var(--terracotta); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) {
          nav { padding: 24px; }
          .nav-links { display: none; }
          .hero { padding: 100px 24px 60px; }
          section { padding: 70px 24px; }
          .work-with-me { padding: 70px 24px; }
          .about-grid { grid-template-columns: 1fr; gap: 48px; }
          .about-photo-wrap { max-width: 100%; }
          .projects-grid, .demos-grid { grid-template-columns: 1fr; }
          .process-row { grid-template-columns: 1fr; }
          .process-step::after { display: none; }
          footer { flex-direction: column; gap: 20px; text-align: center; }
          .hero-scroll { display: none; }
        }
      `}</style>

      <canvas id="particleCanvas"></canvas>

      <nav id="mainNav">
        <a href="/" className="nav-logo">Alante Velez</a>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#work">Work</a>
          <a href="#demos">Demos</a>
          <a href="#services">Services</a>
          <a href="#hire">Work With Me</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg-text" id="heroBgText">DEVELOPER</div>
        <div className="hero-content">
          <div className="hero-tag">Full Stack Developer</div>
          <h1 className="hero-name">From idea<br />to <em>production.</em></h1>
          <div className="typewriter-wrap">
            <span className="typewriter-prefix">~/</span>
            <span id="typewriterText"></span>
            <span className="cursor-blink"></span>
          </div>
          <p className="hero-desc">I design and ship production ready web applications using modern tools. From SaaS platforms to mission driven organizations, every project I take on is built to last.</p>
          <div className="hero-btns">
            <a href="#hire" className="hero-cta magnetic">Start a Project <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
          </div>
        </div>
        <div className="hero-scroll">Scroll</div>
      </section>

      <div className="marquee-wrap">
        <div className="marquee-track">
          <div className="marquee-item">Next.js <span className="marquee-sep">·</span> Supabase <span className="marquee-sep">·</span> Stripe <span className="marquee-sep">·</span> Vercel <span className="marquee-sep">·</span> Resend <span className="marquee-sep">·</span> React <span className="marquee-sep">·</span> TypeScript <span className="marquee-sep">·</span> Tailwind CSS <span className="marquee-sep">·</span> Anthropic API <span className="marquee-sep">·</span> PostgreSQL <span className="marquee-sep">·</span> Node.js <span className="marquee-sep">·</span> REST APIs <span className="marquee-sep">·</span></div>
          <div className="marquee-item">Next.js <span className="marquee-sep">·</span> Supabase <span className="marquee-sep">·</span> Stripe <span className="marquee-sep">·</span> Vercel <span className="marquee-sep">·</span> Resend <span className="marquee-sep">·</span> React <span className="marquee-sep">·</span> TypeScript <span className="marquee-sep">·</span> Tailwind CSS <span className="marquee-sep">·</span> Anthropic API <span className="marquee-sep">·</span> PostgreSQL <span className="marquee-sep">·</span> Node.js <span className="marquee-sep">·</span> REST APIs <span className="marquee-sep">·</span></div>
        </div>
      </div>

      <section id="about">
        <div className="section-label">About</div>
        <h2 className="section-title">Developer who ships<br />real products.</h2>
        <div className="about-grid">
          <div className="about-left">
            <div className="about-photo-wrap">
              <img src="/Alante.PNG" alt="Alante Velez" />
            </div>
            <div className="about-edu">
              <div className="edu-item">
                <div className="edu-degree">M.S. Cybersecurity (In Progress)</div>
                <div className="edu-school">Graduate Studies</div>
              </div>
              <div className="edu-divider"></div>
              <div className="edu-item">
                <div className="edu-degree">B.S. Information Technology</div>
                <div className="edu-school">Bachelor of Science</div>
              </div>
            </div>
          </div>
          <div className="about-right">
            <div className="about-text" style={{marginBottom: '32px'}}>
              <p>I have built an AI travel platform, a custom learning management system, payment workflows, dashboards, and client portals. Most developers talk about building products. I build them, deploy them, and maintain them. If you have hired developers who disappear after handing over a zip file, I am not that.</p>
              <p>Planary generates and delivers fully custom travel itineraries through an <strong>AI pipeline I built end to end</strong>. Rising Sons runs a video player I built from scratch with <strong>per-student access control, progress tracking, and custom playback</strong>, because an embed would not have done what the platform needed.</p>
              <p>My background is in IT, but most of what I know came from building and shipping real products. I work in <strong>Next.js, Supabase, Stripe, PayPal, and the Anthropic API</strong> and handle everything from database schema to deployment.</p>
            </div>
            <div className="about-stats">
              <div className="stat-box" data-observe="true"><div className="stat-num">2</div><div className="stat-label">Client platforms live and actively used</div></div>
              <div className="stat-box" data-observe="true"><div className="stat-num">5+</div><div className="stat-label">Years building independently</div></div>
              <div className="stat-box" data-observe="true"><div className="stat-num">7-10</div><div className="stat-label">Day delivery on most projects</div></div>
              <div className="stat-box" data-observe="true"><div className="stat-num">✓</div><div className="stat-label">Documentation and post-launch support on every project</div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="work">
        <div className="section-label">Selected Work</div>
        <h2 className="section-title">Projects I've built<br />and shipped.</h2>
        <div className="projects-grid">
          <div className="project-card" data-observe="true">
            <div className="project-num">01</div>
            <h3 className="project-title">Planary Travel Itineraries</h3>
            <p className="project-desc">An AI powered travel planning service that generates and delivers custom travel guides automatically. Built end to end with a Grab and Go guide system, Stripe checkout, webhook pipeline, customer dashboard, and admin panel.</p>
            <div className="project-tags"><span className="tag">Next.js</span><span className="tag">Supabase</span><span className="tag">Stripe</span><span className="tag">Anthropic API</span><span className="tag">Resend</span><span className="tag">Vercel</span></div>
            <a href="https://planarytravel.com" target="_blank" className="project-link">Visit Live Site <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
          </div>
          <div className="project-card" data-observe="true">
            <div className="project-num">02</div>
            <h3 className="project-title">Rising Sons Leadership Academy</h3>
            <p className="project-desc">A full stack learning management system for a leadership development organization. Features a custom built video player with per-student access control and progress tracking, PayPal checkout, Zoom integration, interactive games, and student portals.</p>
            <div className="project-tags"><span className="tag">Next.js</span><span className="tag">Supabase</span><span className="tag">PayPal</span><span className="tag">Zoom API</span><span className="tag">TypeScript</span><span className="tag">Vercel</span></div>
            <a href="https://risingsonsacademy.org" target="_blank" className="project-link">Visit Live Site <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
          </div>
        </div>
      </section>

      <section id="demos" style={{background: 'rgba(196,112,74,0.03)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)'}}>
        <div className="section-label">Live Demos</div>
        <h2 className="section-title">Click in and see<br />what I can build.</h2>
        <div className="demos-grid">
          <div className="demo-card teal" data-observe="true">
            <div className="demo-preview" style={{padding:0}}><img src="/demos/demo-1-travel-chatbot.png" alt="AI Travel Chatbot" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/><span className="demo-label">Interactive</span></div>
            <div className="demo-info">
              <div className="demo-num">Demo 01</div>
              <div className="demo-name">AI Travel Chatbot</div>
              <p className="demo-desc">Ask about any destination and get a full itinerary with local tips, hidden gems, and food recommendations. Powered by Claude AI.</p>
              <a href="https://demos.alantevelez.com/demo-1-travel-chatbot.html" target="_blank" className="demo-link">Try It Live <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
            </div>
          </div>
          <div className="demo-card purple" data-observe="true">
            <div className="demo-preview" style={{padding:0}}><img src="/demos/demo-2-saas-dashboard.png" alt="SaaS Dashboard" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/><span className="demo-label">Interactive</span></div>
            <div className="demo-info">
              <div className="demo-num">Demo 02</div>
              <div className="demo-name">SaaS Dashboard</div>
              <p className="demo-desc">A full product dashboard with animated revenue charts, customer table, donut plan distribution, and live stat counters.</p>
              <a href="https://demos.alantevelez.com/demo-2-saas-dashboard.html" target="_blank" className="demo-link">Try It Live <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
            </div>
          </div>
          <div className="demo-card emerald" data-observe="true">
            <div className="demo-preview" style={{padding:0}}><img src="/demos/demo-3-resume-builder.png" alt="AI Resume Builder" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/><span className="demo-label">Interactive</span></div>
            <div className="demo-info">
              <div className="demo-num">Demo 03</div>
              <div className="demo-name">AI Resume Builder</div>
              <p className="demo-desc">Fill in your details and generate a polished, formatted resume document instantly. Download as PDF when done.</p>
              <a href="https://demos.alantevelez.com/demo-3-resume-builder.html" target="_blank" className="demo-link">Try It Live <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
            </div>
          </div>
          <div className="demo-card orange" data-observe="true">
            <div className="demo-preview" style={{padding:0}}><img src="/demos/demo-4-stripe-checkout.png" alt="Stripe Checkout" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/><span className="demo-label">Interactive</span></div>
            <div className="demo-info">
              <div className="demo-num">Demo 04</div>
              <div className="demo-name">Stripe Checkout Flow</div>
              <p className="demo-desc">A full digital storefront with cart management, a 3 step checkout, card input formatting, and an order confirmation state.</p>
              <a href="https://demos.alantevelez.com/demo-4-stripe-checkout.html" target="_blank" className="demo-link">Try It Live <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
            </div>
          </div>
          <div className="demo-card red" data-observe="true">
            <div className="demo-preview" style={{padding:0}}><img src="/demos/demo-5-small-business.png" alt="Small Business Site" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/><span className="demo-label">Full Site</span></div>
            <div className="demo-info">
              <div className="demo-num">Demo 05</div>
              <div className="demo-name">Small Business Website</div>
              <p className="demo-desc">A fully designed local business site with services, testimonials, hero stats, a contact form, and mobile responsive layout.</p>
              <a href="https://demos.alantevelez.com/demo-5-small-business-site.html" target="_blank" className="demo-link">Try It Live <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
            </div>
          </div>
          <div className="demo-card green" data-observe="true">
            <div className="demo-preview" style={{padding:0}}><img src="/demos/demo-6-webhook-dashboard.png" alt="Webhook Dashboard" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/><span className="demo-label">Live Data</span></div>
            <div className="demo-info">
              <div className="demo-num">Demo 06</div>
              <div className="demo-name">Webhook Dashboard</div>
              <p className="demo-desc">A real time event stream dashboard showing live webhook events, payload inspector, latency metrics, and endpoint tracking.</p>
              <a href="https://demos.alantevelez.com/demo-6-webhook-dashboard.html" target="_blank" className="demo-link">Try It Live <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
            </div>
          </div>
          <div className="demo-card green" data-observe="true">
            <div className="demo-preview" style={{padding:0}}><img src="/demos/demo-7-delivery-tracker.png" alt="Live Delivery Tracker" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/><span className="demo-label">Live Tracking</span></div>
            <div className="demo-info">
              <div className="demo-num">Demo 07</div>
              <div className="demo-name">Live Delivery Tracker</div>
              <p className="demo-desc">A real time delivery tracking dashboard with a live driver marker, animated route, ETA countdown, speed stats, and order progress tracking. Built with Google Maps API.</p>
              <a href="https://demos.alantevelez.com/demo-7-delivery-tracker.html" target="_blank" className="demo-link">Try It Live <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
            </div>
          </div>
        </div>
      </section>

      <section id="services">
        <div className="section-label">What I Do</div>
        <h2 className="section-title">Services I offer<br />on every project.</h2>
        <div className="services-grid">
          <div className="service-card" data-observe="true"><span className="service-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M12 2L4 13h7l-1 7 8-11h-7l1-9z" stroke="#C4704A" strokeWidth="1.5" strokeLinejoin="round"/></svg></span><div className="service-name">AI Integration</div><p className="service-desc">Custom Claude API integrations, prompt engineering, and AI powered workflows built for real products.</p></div>
          <div className="service-card" data-observe="true"><span className="service-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="8" height="8" rx="1.5" stroke="#C4704A" strokeWidth="1.5"/><rect x="12" y="2" width="8" height="8" rx="1.5" stroke="#C4704A" strokeWidth="1.5"/><rect x="2" y="12" width="8" height="8" rx="1.5" stroke="#C4704A" strokeWidth="1.5"/><rect x="12" y="12" width="8" height="8" rx="1.5" stroke="#C4704A" strokeWidth="1.5"/></svg></span><div className="service-name">Next.js Development</div><p className="service-desc">Full stack apps and websites using Next.js with server side rendering, authentication, and Vercel deployment.</p></div>
          <div className="service-card" data-observe="true"><span className="service-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="5" width="18" height="13" rx="2" stroke="#C4704A" strokeWidth="1.5"/><path d="M2 9h18" stroke="#C4704A" strokeWidth="1.5"/><path d="M6 13h4" stroke="#C4704A" strokeWidth="1.5" strokeLinecap="round"/></svg></span><div className="service-name">Stripe Payments</div><p className="service-desc">One time checkout, subscriptions, webhooks, and billing systems that work reliably in production.</p></div>
          <div className="service-card" data-observe="true"><span className="service-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><ellipse cx="11" cy="6" rx="8" ry="3" stroke="#C4704A" strokeWidth="1.5"/><path d="M3 6v5c0 1.657 3.582 3 8 3s8-1.343 8-3V6" stroke="#C4704A" strokeWidth="1.5"/><path d="M3 11v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5" stroke="#C4704A" strokeWidth="1.5"/></svg></span><div className="service-name">Supabase Backend</div><p className="service-desc">Database design, Row Level Security policies, authentication, and storage for modern web apps.</p></div>
          <div className="service-card" data-observe="true"><span className="service-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="5" width="18" height="13" rx="2" stroke="#C4704A" strokeWidth="1.5"/><path d="M2 7l9 6 9-6" stroke="#C4704A" strokeWidth="1.5" strokeLinejoin="round"/></svg></span><div className="service-name">Email Automation</div><p className="service-desc">Transactional email systems with Resend including dynamic templates and event triggered delivery.</p></div>
          <div className="service-card" data-observe="true"><span className="service-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2C11 2 16 6 16 11a5 5 0 01-10 0c0-5 5-9 5-9z" stroke="#C4704A" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 15l-3 3M14 15l3 3" stroke="#C4704A" strokeWidth="1.5" strokeLinecap="round"/><circle cx="11" cy="11" r="1.5" fill="#C4704A"/></svg></span><div className="service-name">SaaS Starter Builds</div><p className="service-desc">Production ready SaaS foundations with auth, payments, and database wired up and deployed from day one.</p></div>
        </div>
      </section>

      <section id="hire" className="work-with-me">
        <div className="section-label">Work With Me</div>
        <h2 className="section-title">Let's build something<br /><em style={{fontStyle: 'italic', color: 'var(--terracotta)'}}>that lasts.</em></h2>

        <div className="process-row">
          <div className="process-step" data-observe="true"><div className="process-num">Step 01</div><div className="process-title">Fill out the intake form</div><p className="process-desc">Tell me about your project. Takes about three minutes. You'll book your discovery call right after.</p></div>
          <div className="process-step" data-observe="true"><div className="process-num">Step 02</div><div className="process-title">Discovery call</div><p className="process-desc">A focused 20 minute conversation to confirm scope, timeline, and fit. I'll have reviewed your submission before we speak.</p></div>
          <div className="process-step" data-observe="true"><div className="process-num">Step 03</div><div className="process-title">Proposal and deposit</div><p className="process-desc">You get a signed SOW, a clear deliverables list, and a 50% deposit kicks off the build.</p></div>
        </div>
        <div style={{textAlign: 'center'}}>
          <a href="/intake" className="cta-btn magnetic">Start the Intake Form <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
        </div>
      </section>

      <section className="cta-section">
        <div className="section-label">Ready?</div>
        <h2 className="section-title">Your project starts<br /><em style={{fontStyle: 'italic', color: 'var(--terracotta)'}}>with one form.</em></h2>
        <p className="cta-subtitle">Ready to build? Fill out the intake form and book your discovery call in one shot. Have a question first? Use the same form — just tell me what's on your mind.</p>
        <a href="/intake" className="cta-btn magnetic">Start the Intake Form <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
        <a href="/intake" className="hero-cta-ghost magnetic" style={{marginTop:16,display:"inline-flex",alignItems:"center",gap:14,padding:"16px 32px",border:"1px solid var(--border)",color:"var(--cream)",fontFamily:"DM Mono,monospace",fontSize:"0.78rem",letterSpacing:"0.1em",textTransform:"uppercase",textDecoration:"none",transition:"border-color 0.25s,color 0.25s,transform 0.25s"}}>Have a question first? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
      </section>

      <footer>
        <div className="footer-name">Alante Velez</div>
        <div className="footer-links">
          <a href="https://planarytravel.com" target="_blank">Planary</a>
          <a href="https://risingsonsacademy.org" target="_blank">Rising Sons</a>
          <a href="/intake">Start a Project</a>
        </div>
      </footer>

      <script dangerouslySetInnerHTML={{__html: `
        const canvas = document.getElementById('particleCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        for (let i = 0; i < 55; i++) { particles.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, r: Math.random() * 1.5 + 0.3, dx: (Math.random() - 0.5) * 0.3, dy: (Math.random() - 0.5) * 0.3, alpha: Math.random() * 0.5 + 0.1 }); }
        function animateParticles() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          particles.forEach(p => { p.x += p.dx; p.y += p.dy; if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0; if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(196,112,74,' + p.alpha + ')'; ctx.fill(); });
          particles.forEach((p, i) => { particles.slice(i + 1).forEach(q => { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < 120) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = 'rgba(196,112,74,' + (0.08 * (1 - d / 120)) + ')'; ctx.lineWidth = 0.5; ctx.stroke(); } }); });
          requestAnimationFrame(animateParticles);
        }
        animateParticles();
        window.addEventListener('scroll', () => { document.getElementById('mainNav').classList.toggle('scrolled', window.scrollY > 60); });
        window.addEventListener('mousemove', e => { const x = (e.clientX / window.innerWidth - 0.5) * 20; const y = (e.clientY / window.innerHeight - 0.5) * 20; document.getElementById('heroBgText').style.transform = 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px))'; });
        const words = ['next.js apps', 'stripe payments', 'supabase backends', 'saas products', 'ai integrations', 'real products'];
        let wi = 0, ci = 0, deleting = false;
        function typeWriter() { const word = words[wi]; const el = document.getElementById('typewriterText'); if (!deleting) { el.textContent = word.substring(0, ci + 1); ci++; if (ci === word.length) { deleting = true; setTimeout(typeWriter, 1800); return; } } else { el.textContent = word.substring(0, ci - 1); ci--; if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; } } setTimeout(typeWriter, deleting ? 60 : 90); }
        setTimeout(typeWriter, 1500);
        const observer = new IntersectionObserver(entries => { entries.forEach((entry, i) => { if (entry.isIntersecting) { setTimeout(() => entry.target.classList.add('visible'), i * 120); observer.unobserve(entry.target); } }); }, { threshold: 0.08 });
        document.querySelectorAll('[data-observe]').forEach(el => observer.observe(el));
        document.querySelectorAll('.magnetic').forEach(el => { el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); const x = e.clientX - r.left - r.width / 2; const y = e.clientY - r.top - r.height / 2; el.style.transform = 'translate(' + (x * 0.18) + 'px, ' + (y * 0.18) + 'px)'; }); el.addEventListener('mouseleave', () => { el.style.transform = ''; }); });
      `}} />
    </>
  )
}
