'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './LandingPage.module.css';

// ─── SVG ICONS ─────────────────────────────────────────────────────────────

type SvgProps = React.SVGProps<SVGSVGElement> & { size?: number };

const Icons = {
  ArrowRight: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: (p: SvgProps) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Bolt: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 20 20" fill="none" {...p}>
      <path d="M11 2L4 11h5l-1 7 7-9h-5l1-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  GitBranch: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 20 20" fill="none" {...p}>
      <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="5" cy="15" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 7v6M7 5h4a2 2 0 012 2v0a2 2 0 01-2 2H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Clock: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 16 16" fill="none" {...p}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Queue: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 20 20" fill="none" {...p}>
      <rect x="2" y="4" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="9" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="14" width="8" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  Mail: (p: SvgProps) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 16 16" fill="none" {...p}>
      <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M2 5l6 4 6-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Bell: (p: SvgProps) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M6 13a2 2 0 004 0M4 6a4 4 0 018 0c0 3 1.5 5 2 5.5H2c.5-.5 2-2.5 2-5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Phone: (p: SvgProps) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 16 16" fill="none" {...p}>
      <rect x="4" y="1" width="8" height="14" rx="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7 12h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Webhook: (p: SvgProps) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 16 16" fill="none" {...p}>
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="13" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 6v2a4 4 0 004 4M12 6v2a4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  Github: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 18 18" fill="currentColor" {...p}>
      <path d="M9 1C4.58 1 1 4.58 1 9c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0017 9c0-4.42-3.58-8-8-8z"/>
    </svg>
  ),
  Server: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 20 20" fill="none" {...p}>
      <rect x="3" y="2" width="14" height="6" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3" y="12" width="14" height="6" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="6" cy="5" r="1" fill="currentColor"/>
      <circle cx="6" cy="15" r="1" fill="currentColor"/>
    </svg>
  ),
  Shield: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 20 20" fill="none" {...p}>
      <path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Layers: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 20 20" fill="none" {...p}>
      <path d="M10 2l8 4.5-8 4.5L2 6.5 10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M2 10l8 4.5L18 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 13.5l8 4.5 8-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Activity: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 20 20" fill="none" {...p}>
      <polyline points="2,12 6,6 10,14 14,8 18,10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  CheckCircle: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 20 20" fill="none" {...p}>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6.5 10l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Terminal: (p: SvgProps) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 16 16" fill="none" {...p}>
      <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 6l3 2-3 2M8 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ─── ANIMATED COUNTER ──────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !seen.current) {
        seen.current = true;
        let start = 0;
        const duration = 2000;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
          start += increment;
          if (start >= target) { setCount(target); clearInterval(timer); }
          else setCount(Math.floor(start));
        }, 16);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── PULSE DOT ─────────────────────────────────────────────────────────────

function PulseDot({ color = '#ff6b35', size = 6 }: { color?: string; size?: number }) {
  return (
    <span className={styles.pulseDotWrap} style={{ width: size, height: size }}>
      <span className={styles.pulseDotCore} style={{ background: color }} />
      <span className={styles.pulseDotRing} style={{ background: color }} />
    </span>
  );
}

// ─── PACKET TRACK ──────────────────────────────────────────────────────────

function PacketTrack({ delay = 0 }: { delay?: number }) {
  return (
    <div className={styles.packetTrack}>
      {[0, 0.8, 1.6].map((d, i) => (
        <div
          key={i}
          className={styles.packet}
          style={{
            background: i === 0 ? '#e74c3c' : i === 1 ? '#e67e22' : '#f39c12',
            boxShadow: `0 0 8px ${i === 0 ? '#e74c3c' : i === 1 ? '#e67e22' : '#f39c12'}`,
            animationDelay: `${delay + d}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── WAVEFORM ──────────────────────────────────────────────────────────────

function Waveform({ bars = 12 }: { bars?: number }) {
  return (
    <div className={styles.waveform}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className={styles.waveBar} style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

// ─── SECTION REVEAL ────────────────────────────────────────────────────────

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add(styles.revealed); observer.disconnect(); }
    }, { threshold: 0.1, rootMargin: '-60px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`${styles.reveal} ${className}`}>{children}</div>;
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('mousemove', onMouse); window.removeEventListener('scroll', onScroll); };
  }, []);

  const queueItems = [
    { id: 'evt-8821', event: 'user.signup', channel: 'EMAIL', priority: 'high', attempts: '1/3', status: 'processing' },
    { id: 'evt-8820', event: 'payment.success', channel: 'PUSH', priority: 'high', attempts: '1/1', status: 'delivered' },
    { id: 'evt-8819', event: 'order.shipped', channel: 'SMS', priority: 'medium', attempts: '2/3', status: 'retrying' },
    { id: 'evt-8818', event: 'trial.expiring', channel: 'EMAIL', priority: 'medium', attempts: '0/3', status: 'queued' },
    { id: 'evt-8817', event: 'workspace.invite', channel: 'WEBHOOK', priority: 'low', attempts: '1/3', status: 'processing' },
  ];

  return (
    <div className={styles.container}>
      {/* CURSOR GLOW */}
      <div
        className={styles.cursorGlow}
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(192,57,43,0.04), transparent 60%)`,
        }}
      />

      {/* ─── NAV ─── */}
      <nav className={`${styles.nav} ${navScrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.navLogo}>
            <div className={styles.navLogoMark}>V</div>
            <span className={styles.logoText}>Varta</span>
          </Link>
          <ul className={styles.navLinks}>
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#docs">Docs</a></li>
            <li>
              <a href="https://github.com" aria-label="GitHub">
                <Icons.Github size={16} style={{ display: 'block' }} />
              </a>
            </li>
          </ul>
          <div className={styles.navActions}>
            <Link href="/login" className={styles.btnGhost}>Sign In</Link>
            <Link href="/login" className={styles.btnPrimary}>
              Get Started <Icons.ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className={styles.hero}>
        {/* Grid background */}
        <div className={styles.heroGrid} />
        {/* Gradient orbs */}
        <div className={styles.heroOrb1} />
        <div className={styles.heroOrb2} />

        <div className={styles.heroInner}>
          {/* Left */}
          <div className={styles.heroLeft}>
            <div className={styles.heroTag}>
              <PulseDot color="#ff6b35" size={6} />
              <span>Open-source infrastructure</span>
            </div>

            <h1 className={styles.heroHeadline}>
              <span className={styles.heroAccent}>Varta.</span><br />
              Notification infra<br />
              built for ops.
            </h1>

            <p className={styles.heroSub}>
              Varta is the orchestration layer between your application events and every message
              your users receive. Queue, route, fan-out, retry, and deliver — across every channel —
              without building it yourself.
            </p>

            <div className={styles.heroActions}>
              <Link href="/login" className={styles.btnLarge}>
                Start Building Free <Icons.ArrowRight size={14} />
              </Link>
              <a href="https://github.com" className={styles.btnOutlineLarge}>
                <Icons.Github size={14} /> Star on GitHub
              </a>
            </div>

            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>
                  <AnimatedCounter target={8241094} />
                </span>
                <span className={styles.heroStatLabel}>events routed today</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue} style={{ color: 'var(--color-primary-400)' }}>50ms</span>
                <span className={styles.heroStatLabel}>p99 latency</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue} style={{ color: 'var(--color-amber)' }}>99.97%</span>
                <span className={styles.heroStatLabel}>delivery rate</span>
              </div>
            </div>
          </div>

          {/* Right — Orchestration Panel */}
          <div className={styles.heroRight}>
            <div className={styles.orchestrationPanel}>
              {/* Titlebar */}
              <div className={styles.panelTitlebar}>
                <div className={styles.panelDots}>
                  <div className={styles.panelDot} style={{ background: '#FF5F57' }} />
                  <div className={styles.panelDot} style={{ background: '#FEBC2E' }} />
                  <div className={styles.panelDot} style={{ background: '#28C840' }} />
                </div>
                <span className={styles.panelFilename}>notification-run.ts</span>
                <div className={styles.panelLiveBadge}>
                  <PulseDot color="#e74c3c" size={4} />
                  LIVE
                </div>
              </div>

              <div className={styles.panelBody}>
                {/* Incoming event */}
                <div className={styles.eventBlock}>
                  <div className={styles.eventLabel}>▸ INCOMING EVENT</div>
                  <div className={styles.eventName}>user.payment_failed</div>
                  <div className={styles.eventDesc}>
                    Workspace rule matched. Fan-out prepared for push, email, and in-app delivery.
                  </div>
                </div>

                <PacketTrack delay={0} />

                {/* Pipeline steps */}
                <div className={styles.pipelineSteps}>
                  {[
                    { Icon: Icons.Bolt, color: '#e74c3c', bg: 'rgba(192,57,43,0.15)', title: 'Event ingested & normalized', desc: 'Schema validated. Workspace rules applied.', badge: '12ms', active: true },
                    { Icon: Icons.GitBranch, color: '#e67e22', bg: 'rgba(211,84,0,0.15)', title: 'Rule match: dunning-v2', desc: 'Push first, email if device offline.', badge: '3ms', active: true },
                    { Icon: Icons.Clock, color: '#f39c12', bg: 'rgba(243,156,18,0.15)', title: 'Smart timing applied', desc: 'Subscriber send window: 09:00–21:00 local.', badge: '1ms', active: true },
                    { Icon: Icons.Queue, color: '#27ae60', bg: 'rgba(39,174,96,0.15)', title: 'Fan-out to 3 workers', desc: 'Queue depth: 142. Processing rate: 800/s.', badge: 'queued', active: false },
                  ].map((s, i) => (
                    <div key={i} className={`${styles.pipelineStep} ${s.active ? styles.stepActive : ''}`}>
                      <div className={styles.stepIcon} style={{ background: s.bg }}>
                        <s.Icon size={13} style={{ color: s.color }} />
                      </div>
                      <div className={styles.stepInfo}>
                        <div className={styles.stepTitle}>{s.title}</div>
                        <div className={styles.stepDesc}>{s.desc}</div>
                      </div>
                      <span className={`${styles.stepBadge} ${!s.active ? styles.stepBadgePending : ''}`}>{s.badge}</span>
                    </div>
                  ))}
                </div>

                <PacketTrack delay={0.4} />

                {/* Channels */}
                <div className={styles.channelRow}>
                  {[
                    { Icon: Icons.Mail, label: 'Email' },
                    { Icon: Icons.Bell, label: 'Push' },
                    { Icon: Icons.Phone, label: 'SMS' },
                    { Icon: Icons.Webhook, label: 'Webhook' },
                  ].map(({ Icon, label }) => (
                    <div key={label} className={styles.channelChip}>
                      <Icon size={12} /> {label}
                    </div>
                  ))}
                </div>

                {/* Meta row */}
                <div className={styles.panelMetaRow}>
                  <div className={styles.panelMetaCard}>
                    <div className={styles.panelMetaLabel}>Fallback chain</div>
                    <div className={styles.panelMetaValue}>Push → Email → SMS</div>
                  </div>
                  <div className={styles.panelMetaCard}>
                    <div className={styles.panelMetaLabel}>Queue visibility</div>
                    <div className={styles.panelMetaValue}>Delivery streams in real-time</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className={styles.scrollCue}>
          <span className={styles.scrollLabel}>SCROLL</span>
          <div className={styles.scrollLine} />
        </div>
      </section>

      {/* ─── PROBLEM ─── */}
      <section id="features" className={styles.sectionProblem}>
        <Reveal>
          <div className={styles.problemGrid}>
            <div>
              <div className={styles.sectionOverline}>The Problem</div>
              <h2 className={styles.sectionHeadline}>
                You duct-taped<br />
                five services<br />
                together.
              </h2>
              <p className={styles.sectionBody} style={{ marginTop: 24 }}>
                Email lives in Resend. Push is somewhere in FCM. SMS is a Twilio wrapper
                nobody remembers writing. Retries are a cron job. Timing is &ldquo;just send it now.&rdquo;
                Analytics are guesses. And none of it talks to each other.
              </p>
              <p className={styles.sectionBody} style={{ marginTop: 16 }}>
                Varta replaces all of it with one routing layer that handles orchestration,
                queueing, provider failover, and real-time observability — without you writing
                infrastructure code.
              </p>
            </div>

            <div>
              <div className={styles.problemTableHeader}>
                <span className={styles.monoLabel}>BEFORE → AFTER</span>
              </div>
              <div className={styles.problemStack}>
                {([
                  ['ROUTING', 'if/else chains', 'Rule engine'],
                  ['QUEUES', 'bull + redis DIY', 'Built-in worker pool'],
                  ['RETRIES', 'cron job scripts', 'Exponential backoff'],
                  ['PROVIDERS', 'per-SDK sprawl', 'Provider abstraction'],
                  ['TIMING', 'best guess', 'ML send windows'],
                  ['OBSERVABILITY', 'logs grep', 'Delivery analytics'],
                  ['MULTI-CHANNEL', 'n × codebases', 'One event, any channel'],
                ] as [string, string, string][]).map(([label, before, after]) => (
                  <div key={label} className={styles.problemRow}>
                    <div className={styles.problemRowLabel}>{label}</div>
                    <div className={styles.problemRowContent}>
                      <span className={styles.oldTag}>{before}</span>
                      <span className={styles.arrowSep}>→</span>
                      <span className={styles.newTag}>{after}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── HOW IT WORKS — JOURNEY ─── */}
      <section id="how-it-works" className={styles.sectionJourney}>
        <Reveal>
          <div className={styles.journeyHeader}>
            <div>
              <div className={styles.sectionOverline}>How It Works</div>
              <h2 className={styles.sectionHeadline}>
                One event.<br />Every channel.
              </h2>
            </div>
            <div>
              <p className={styles.sectionBody}>
                Drop an event into Varta. Watch it get normalized, routed through your rule engine,
                scheduled against subscriber timing windows, fanned out across workers, and delivered
                to any number of channels — with retries, fallbacks, and analytics included.
              </p>
              <div className={styles.statusRow} style={{ marginTop: 24 }}>
                <PulseDot color="#27ae60" size={6} />
                <span className={styles.monoLabel}>Pipeline throughput: 847 events/sec</span>
                <Waveform bars={10} />
              </div>
            </div>
          </div>

          <div className={styles.journeyPipeline}>
            {[
              { Icon: Icons.Activity, label: 'Ingest', count: '8.2M/day', active: true },
              { Icon: Icons.Layers, label: 'Normalize', count: '100%', active: true },
              { Icon: Icons.GitBranch, label: 'Route', count: '12 rules', active: true },
              { Icon: Icons.Bolt, label: 'Fan-out', count: '1→N', active: true },
              { Icon: Icons.Queue, label: 'Queue', count: '142 depth', active: false },
              { Icon: Icons.Server, label: 'Workers', count: '48 active', active: false },
              { Icon: Icons.CheckCircle, label: 'Delivered', count: '99.97%', active: false },
            ].map(({ Icon, label, count, active }, i) => (
              <div key={i} className={`${styles.journeyNode} ${active ? styles.journeyNodeActive : ''}`}>
                <div className={`${styles.journeyNodeIcon} ${active ? styles.journeyIconActive : ''}`}>
                  <Icon size={22} />
                </div>
                <span className={styles.journeyNodeLabel}>{label}</span>
                <span className={styles.journeyNodeCount}>{count}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 48 }}>
            <PacketTrack delay={0} />
            <PacketTrack delay={0.3} />
            <PacketTrack delay={0.9} />
          </div>
        </Reveal>
      </section>

      {/* ─── ROUTING ENGINE ─── */}
      <section className={styles.sectionRouting}>
        <Reveal className={styles.routingGrid}>
          {/* Visual */}
          <div className={styles.routingVisual}>
            <div className={styles.routingVisualHeader}>
              <span>ROUTING ENGINE</span>
              <PulseDot color="#ff6b35" size={5} />
            </div>

            <div className={styles.routingTree}>
              <div className={styles.routingRoot}>
                <span>user.payment_failed</span>
                <span className={styles.routingRootSub}>event</span>
              </div>
              <div className={styles.routingBranches}>
                {([
                  { label: 'IF', value: "plan === 'pro'", delivery: 'Push → Email', color: 'var(--color-primary-500)' },
                  { label: 'IF', value: 'trial_days_left < 3', delivery: 'Email + In-App', color: 'var(--color-orange)' },
                  { label: 'ELSE', value: 'default fallback', delivery: 'In-App only', color: 'var(--color-amber)' },
                ] as { label: string; value: string; delivery: string; color: string }[]).map((branch, i) => (
                  <div key={i} className={styles.routingBranch}>
                    <div className={styles.routingRule}>
                      <div className={styles.routingRuleLabel} style={{ color: branch.color }}>{branch.label}</div>
                      <div className={styles.routingRuleValue}>{branch.value}</div>
                    </div>
                    <div className={styles.routingDelivery}>
                      <PulseDot color="#27ae60" size={4} />
                      {branch.delivery}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <PacketTrack delay={0} />

            {/* Code block */}
            <div className={styles.codeBlock}>
              <div className={styles.codeTitlebar}>
                <div className={styles.panelDots}>
                  <div className={styles.panelDot} style={{ background: '#FF5F57' }} />
                  <div className={styles.panelDot} style={{ background: '#FEBC2E' }} />
                  <div className={styles.panelDot} style={{ background: '#28C840' }} />
                </div>
                <span className={styles.panelFilename}>routing-rule.ts</span>
              </div>
              <pre className={styles.codeBody}><code>{`defineRule({
  event: 'user.payment_failed',
  match: {
    plan: 'pro',
    attempts: { lte: 2 }
  },
  channels: ['push', 'email'],
  fallback: ['sms'],
  timing: 'smart',
})`}</code></pre>
            </div>
          </div>

          {/* Copy */}
          <div className={styles.routingCopy}>
            <div className={styles.sectionOverline}>Routing Engine</div>
            <h2 className={styles.sectionHeadline}>
              Rules, not<br />if-else chains.
            </h2>
            <p className={styles.sectionBody} style={{ marginTop: 20, marginBottom: 28 }}>
              Define workspace-level routing rules that match against event properties, subscriber
              attributes, and workspace context. The engine evaluates matches in microseconds and
              selects the right channel mix, provider chain, and timing strategy automatically.
            </p>

            <div className={styles.featureList}>
              {[
                ['Condition matching', 'Match on any event or subscriber property with boolean logic.'],
                ['Channel priority', 'Define ordered channel stacks with automatic fallthrough.'],
                ['Scoped rules', 'Per-workspace, per-tenant, or per-subscriber rule overrides.'],
                ['Version-controlled', 'Rules live in your codebase, not a third-party dashboard.'],
              ].map(([title, desc]) => (
                <div key={title} className={styles.featureItem}>
                  <span className={styles.featureArrow}>→</span>
                  <div>
                    <div className={styles.featureTitle}>{title}</div>
                    <div className={styles.featureDesc}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── QUEUE WORKERS ─── */}
      <section className={styles.sectionQueue}>
        <Reveal className={styles.queueGrid}>
          {/* Copy */}
          <div>
            <div className={styles.sectionOverline}>Queue Workers</div>
            <h2 className={styles.sectionHeadline}>
              Queues that<br />actually work.
            </h2>
            <p className={styles.sectionBody} style={{ marginTop: 20, marginBottom: 36 }}>
              Events enter a durable queue before hitting any provider. Workers process with
              configurable concurrency, backpressure, and priority lanes. Visibility into queue
              depth, processing rate, and per-event state — without tailing logs.
            </p>

            <div className={styles.featureList}>
              {[
                ['Priority lanes', 'High/medium/low lanes ensure critical events process first.'],
                ['Backpressure', 'Rate-limit per provider to avoid downstream throttling.'],
                ['Dead letter', 'Failed events land in DLQ with full context for reprocessing.'],
                ['Batch fan-out', 'Broadcast to thousands of subscribers in a single event.'],
              ].map(([title, desc]) => (
                <div key={title} className={styles.featureItem}>
                  <span className={styles.featureArrow} style={{ color: 'var(--color-orange)' }}>▸</span>
                  <div>
                    <div className={styles.featureTitle}>{title}</div>
                    <div className={styles.featureDesc}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Queue visual */}
          <div>
            <div className={styles.queueLabelRow}>
              <span>QUEUE: notifications-primary</span>
              <span className={styles.queueLabelRight}>
                <PulseDot color="#ff6b35" size={5} />
                142 pending
              </span>
            </div>

            <div className={styles.queueList}>
              {queueItems.map((item) => (
                <div key={item.id} className={styles.queueItem}>
                  <div className={`${styles.queuePriority} ${styles[`priority_${item.priority}` as keyof typeof styles]}`} />
                  <div className={styles.queueItemBody}>
                    <span className={styles.queueEventName}>{item.event}</span>
                    <div className={styles.queueMeta}>
                      <span className={styles.queueChannelTag}>{item.channel}</span>
                      <span className={styles.queueAttempts}>{item.attempts}</span>
                    </div>
                  </div>
                  <div className={`${styles.queueStatus} ${styles[`qs_${item.status}` as keyof typeof styles]}`}>
                    {item.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.workerStrip}>
              {[
                { name: 'worker-01', load: 82, rate: '314/s' },
                { name: 'worker-02', load: 67, rate: '248/s' },
                { name: 'worker-03', load: 91, rate: '370/s' },
                { name: 'worker-04', load: 44, rate: '176/s' },
              ].map((w) => (
                <div key={w.name} className={styles.workerCard}>
                  <div className={styles.workerName}>{w.name}</div>
                  <div className={styles.workerBar}>
                    <div className={styles.workerFill} style={{ width: `${w.load}%` }} />
                  </div>
                  <div className={styles.workerRate}>{w.rate}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── SCALE METRICS ─── */}
      <section className={styles.sectionScale}>
        <div className={styles.scaleBgNumber}>10M</div>
        <Reveal>
          <div className={styles.scaleGrid}>
            {[
              { unit: 'Throughput', value: '10M+', desc: 'Events processed per day across all channels', color: 'var(--color-primary-500)' },
              { unit: 'P99 Latency', value: '50ms', desc: 'End-to-end delivery from event ingestion to provider', color: 'var(--color-orange)' },
              { unit: 'Delivery Rate', value: '99.97%', desc: 'Messages successfully delivered with automatic retry', color: 'var(--color-amber)' },
              { unit: 'Channels', value: '5+', desc: 'Email, Push, SMS, Webhook, and In-App unified', color: 'var(--color-gold)' },
            ].map((m, i) => (
              <div key={i} className={styles.scaleMetric} style={{ '--accent': m.color } as React.CSSProperties}>
                <div className={styles.scaleMetricUnit}>{m.unit}</div>
                <div className={styles.scaleMetricValue} style={{ color: m.color }}>{m.value}</div>
                <div className={styles.scaleMetricDesc}>{m.desc}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className={styles.sectionPricing}>
        <Reveal>
          <div className={styles.pricingHeader}>
            <div className={styles.sectionOverline}>Pricing</div>
            <h2 className={styles.sectionHeadline}>Scale without limits.</h2>
          </div>

          <div className={styles.pricingGrid}>
            {/* Starter */}
            <div className={styles.pricingTier}>
              <div className={styles.pricingTierTag}>FREE</div>
              <div className={styles.pricingTierName}>STARTER</div>
              <div className={styles.pricingPrice}>$0</div>
              <div className={styles.pricingPriceSub}>/month</div>
              <p className={styles.pricingDesc}>Everything you need to get started. No credit card required.</p>
              <div className={styles.pricingFeatures}>
                {['Up to 10k events/mo', '2 channels', 'Community support', 'Self-hostable'].map(f => (
                  <div key={f} className={styles.pricingFeature}>
                    <Icons.Check size={12} style={{ color: '#ff6b35', flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/login" className={styles.pricingCta}>Start Free</Link>
            </div>

            {/* Pro — featured */}
            <div className={`${styles.pricingTier} ${styles.pricingTierFeatured}`}>
              <div className={styles.pricingTierTag}>MOST POPULAR</div>
              <div className={styles.pricingTierName}>PRO</div>
              <div className={styles.pricingPrice}>$29</div>
              <div className={styles.pricingPriceSub}>/month</div>
              <p className={styles.pricingDesc}>For teams shipping at scale with full observability and all channels.</p>
              <div className={styles.pricingFeatures}>
                {['Up to 1M events/mo', 'All channels', 'Email support', '30-day retention', 'Smart send timing'].map(f => (
                  <div key={f} className={styles.pricingFeature}>
                    <Icons.Check size={12} style={{ color: '#ff6b35', flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/login" className={`${styles.pricingCta} ${styles.pricingCtaFeatured}`}>Start Free Trial</Link>
            </div>

            {/* Enterprise */}
            <div className={styles.pricingTier}>
              <div className={styles.pricingTierTag}>ENTERPRISE</div>
              <div className={styles.pricingTierName}>CUSTOM</div>
              <div className={styles.pricingPrice}>—</div>
              <div className={styles.pricingPriceSub}>custom pricing</div>
              <p className={styles.pricingDesc}>Dedicated infrastructure, SLAs, and a success manager for your team.</p>
              <div className={styles.pricingFeatures}>
                {['Unlimited events', 'Custom integrations', 'Dedicated success manager', 'SLAs & SOC2', 'On-prem option'].map(f => (
                  <div key={f} className={styles.pricingFeature}>
                    <Icons.Check size={12} style={{ color: '#ff6b35', flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/contact" className={styles.pricingCta}>Contact Sales</Link>
            </div>
          </div>

          {/* Self-host banner */}
          <div className={styles.selfHostBanner}>
            <div className={styles.selfHostIcon}>
              <Icons.Terminal size={20} />
            </div>
            <div>
              <div className={styles.selfHostTitle}>Prefer to self-host?</div>
              <div className={styles.selfHostDesc}>
                Run Varta on your own infrastructure. MIT licensed, Docker-ready, zero lock-in.
              </div>
            </div>
            <a href="https://github.com" className={styles.selfHostCta}>View Docs</a>
          </div>
        </Reveal>
      </section>

      {/* ─── CTA ─── */}
      <section className={styles.sectionCta}>
        <div className={styles.ctaGlow} />
        <Reveal>
          <div className={styles.ctaEyebrow}>Ready to ship?</div>
          <h2 className={styles.ctaHeadline}>
            Stop building<br />
            notification infra.<br />
            <span className={styles.heroAccent}>Start shipping.</span>
          </h2>
          <p className={styles.ctaSub}>
            Join teams already routing millions of events through Varta.
            Set up in minutes, scale to billions.
          </p>
          <div className={styles.ctaActions}>
            <Link href="/login" className={styles.btnLarge}>
              Get Started for Free <Icons.ArrowRight size={14} />
            </Link>
            <a href="https://github.com" className={styles.btnOutlineLarge}>
              <Icons.Github size={14} /> Star on GitHub
            </a>
          </div>
        </Reveal>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <div className={styles.navLogoMark} style={{ width: 24, height: 24, fontSize: 11 }}>V</div>
          <span className={styles.footerBrand}>Varta</span>
          <span className={styles.footerTagline}>notification infrastructure</span>
        </div>
        <div className={styles.footerLinks}>
          <a href="#" className={styles.footerLink}>Docs</a>
          <a href="#" className={styles.footerLink}>GitHub</a>
          <a href="#" className={styles.footerLink}>Twitter</a>
          <a href="#" className={styles.footerLink}>Status</a>
        </div>
        <div className={styles.footerRight}>
          <span className={styles.statusDot} />
          All systems operational
        </div>
      </footer>
    </div>
  );
}
