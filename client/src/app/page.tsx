'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import {
  Check,
  GitBranch,
  Mail,
  Smartphone,
  Webhook,
  Zap,
  Settings,
  MessageSquare,
  Globe,
  Server,
  ArrowRight,
  ChevronRight,
  Bell,
  Shield,
  BarChart3,
  Layers,
} from 'lucide-react';
import styles from './LandingPage.module.css';

/* ─── Pricing ─── */
const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: '/forever',
    desc: 'Perfect for side projects and learning.',
    features: ['1,000 notifications/mo', '2 channels', 'Community support', 'Basic analytics'],
    btnLabel: 'Start Free',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    desc: 'For growing products that need scale.',
    features: ['50,000 notifications/mo', 'Unlimited channels', 'AI Smart Timing', 'Priority support'],
    btnLabel: 'Start Pro Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'Self-hosted deployments with SLA.',
    features: ['Unlimited notifications', 'Self-hosted option', 'Custom SLA', 'Dedicated support'],
    btnLabel: 'Contact Sales',
    featured: false,
  },
];

/* ─── Feature Data for Scroll-Spy ─── */
const features = [
  {
    id: 'omnichannel',
    title: 'Omnichannel Delivery',
    desc: 'Route notifications through Email, SMS, Push, In-App, and Chat — with automatic fallback chains. If push fails, cascade to email, then SMS.',
    icon: GitBranch,
    accent: '#38bdf8',
  },
  {
    id: 'workflows',
    title: 'Visual Workflow Engine',
    desc: 'Design complex notification DAGs with our drag-and-drop builder. Conditional branching, delays, and A/B testing — all without code.',
    icon: Layers,
    accent: '#818cf8',
  },
  {
    id: 'smart-timing',
    title: 'AI Smart Timing',
    desc: 'Deliver messages when users are most likely to engage. Our ML model learns optimal send windows per subscriber, per channel.',
    icon: Zap,
    accent: '#2dd4bf',
  },
  {
    id: 'analytics',
    title: 'Delivery Analytics',
    desc: 'Track every notification lifecycle — from trigger to open. Real-time dashboards with delivery rates, latency percentiles, and engagement metrics.',
    icon: BarChart3,
    accent: '#f59e0b',
  },
  {
    id: 'security',
    title: 'Enterprise Security',
    desc: 'AES-256 encrypted provider credentials, JWT authentication, workspace isolation, and audit logs. SOC2-ready architecture out of the box.',
    icon: Shield,
    accent: '#f43f5e',
  },
];

/* ─── Pipeline Steps ─── */
const pipelineSteps = [
  { label: 'Event Triggered', icon: Bell },
  { label: 'Rule Engine', icon: Settings },
  { label: 'Smart Timing', icon: Zap },
];

const channels = [
  { label: 'Email', icon: Mail },
  { label: 'Push', icon: Smartphone },
  { label: 'In-App', icon: MessageSquare },
  { label: 'Webhook', icon: Webhook },
];

/* ─── Animated Section Wrapper ─── */
function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* Scroll-spy for sticky sidebar */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = featureRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActiveFeature(idx);
          }
        });
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0.1 }
    );

    featureRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      {/* Background layers */}
      <div className={styles.glowOrb} />
      <div className={styles.glowOrbSecondary} />
      <div className={styles.gridOverlay} />
      <div className={styles.watermark}>वार्तालाप</div>

      <div className={styles.content}>
        {/* ═══════════ NAVIGATION ═══════════ */}
        <nav className={styles.nav}>
          <div className={styles.navInner}>
            <Link href="/" className={styles.brand}>
              <div className={styles.logo}>V</div>
              <span className={styles.logoText}>Varta</span>
            </Link>

            <div className={styles.navLinks}>
              <Link href="#features">Features</Link>
              <Link href="#pipeline">How It Works</Link>
              <Link href="#pricing">Pricing</Link>
              <Link href="/docs">Docs</Link>
            </div>

            <div className={styles.navActions}>
              <Link href="/login" className={styles.signInBtn}>Sign In</Link>
              <Link href="/signup" className={styles.ctaSmall}>
                Get Started <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </nav>

        {/* ═══════════ HERO ═══════════ */}
        <header className={styles.hero}>
          <motion.div
            className={styles.heroInner}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className={styles.heroBadge}>
              <span className={styles.badgeDot} />
              <span>Varta 2.0 — Now Open Source</span>
              <ChevronRight size={14} />
            </div>

            <h1 className={styles.heroTitle}>
              The Notification Infrastructure{' '}
              <span className={styles.heroGradient}>Built for Scale</span>
            </h1>

            <p className={styles.heroSub}>
              Open-source, omnichannel notifications with intelligent routing,
              real-time delivery, and actionable analytics — all self-hostable.
            </p>

            <div className={styles.heroCtas}>
              <Link href="/signup" className={styles.ctaPrimary}>
                Start Building Free <ArrowRight size={16} />
              </Link>
              <Link href="/docs" className={styles.ctaSecondary}>
                Read the Docs
              </Link>
            </div>
          </motion.div>
        </header>

        {/* ═══════════ BENTO SHOWCASE (3 cool components) ═══════════ */}
        <section className={styles.showcase}>
          <AnimatedSection className={styles.bentoRow}>
            {/* Integrations Galaxy */}
            <div className={`${styles.bentoCard} ${styles.bentoWide}`}>
              <div className={styles.bentoLabel}>
                <h3>Integrations Galaxy</h3>
                <p>Connect any provider in seconds. Email, SMS, Push, Chat — all unified.</p>
              </div>
              <div className={styles.galaxyWrap}>
                <div className={styles.galaxyRing} />
                <div className={styles.galaxyRingOuter} />
                <div className={styles.galaxyCenter}>V</div>
                <div className={`${styles.galaxyNode} ${styles.gn1}`}><Mail size={16} /></div>
                <div className={`${styles.galaxyNode} ${styles.gn2}`}><Smartphone size={16} /></div>
                <div className={`${styles.galaxyNode} ${styles.gn3}`}><MessageSquare size={16} /></div>
                <div className={`${styles.galaxyNode} ${styles.gn4}`}><Webhook size={16} /></div>
                <div className={`${styles.galaxyNode} ${styles.gn5}`}><Globe size={16} /></div>
              </div>
            </div>

            {/* Code Preview */}
            <div className={styles.bentoCard}>
              <div className={styles.bentoLabel}>
                <h3>Code-First Config</h3>
                <p>Define everything as code. Version-controlled, reviewable, deployable.</p>
              </div>
              <div className={styles.codeBlock}>
                <div className={styles.codeBar}>
                  <div className={styles.codeDots}>
                    <span className={styles.dotRed} />
                    <span className={styles.dotYellow} />
                    <span className={styles.dotGreen} />
                  </div>
                  <span className={styles.codeFilename}>varta.config.ts</span>
                </div>
                <pre className={styles.codeContent}>
                  <code>{`import { defineConfig } from 'varta';

export default defineConfig({
  channels: {
    email: { provider: 'resend' },
    push:  { provider: 'fcm' },
    inApp: { provider: 'varta' },
  },
  fallback: ['push', 'email', 'sms'],
  retry: { maxAttempts: 3 },
});`}</code>
                </pre>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection className={styles.bentoRow} delay={0.15}>
            {/* Real-time Inbox */}
            <div className={styles.bentoCard}>
              <div className={styles.bentoLabel}>
                <h3>Real-time Inbox</h3>
                <p>WebSocket-powered in-app notifications with sub-50ms delivery.</p>
              </div>
              <div className={styles.inbox}>
                <div className={styles.inboxHeader}>
                  <Bell size={14} />
                  <span>Notifications</span>
                  <span className={styles.inboxCount}>3</span>
                </div>
                <div className={styles.inboxItem}>
                  <div className={`${styles.inboxDot} ${styles.dotBlue}`} />
                  <div className={styles.inboxBody}>
                    <strong>Deployment successful</strong>
                    <span>Production v2.4.1 deployed — 2 min ago</span>
                  </div>
                </div>
                <div className={styles.inboxItem}>
                  <div className={`${styles.inboxDot} ${styles.dotPurple}`} />
                  <div className={styles.inboxBody}>
                    <strong>New subscriber</strong>
                    <span>user@acme.co joined workspace — 15 min ago</span>
                  </div>
                </div>
                <div className={styles.inboxItem}>
                  <div className={`${styles.inboxDot} ${styles.dotCyan}`} />
                  <div className={styles.inboxBody}>
                    <strong>Workflow triggered</strong>
                    <span>welcome-flow executed for 142 users — 1 hr ago</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className={`${styles.bentoCard} ${styles.bentoWide}`}>
              <div className={styles.bentoLabel}>
                <h3>Built for Throughput</h3>
                <p>Enterprise-grade performance metrics from day one.</p>
              </div>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statNumber}>50ms</span>
                  <span className={styles.statLabel}>p99 Latency</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statNumber}>99.9%</span>
                  <span className={styles.statLabel}>Delivery Rate</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statNumber}>10M+</span>
                  <span className={styles.statLabel}>Notifications/Day</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statNumber}>5</span>
                  <span className={styles.statLabel}>Channels</span>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </section>

        {/* ═══════════ PIPELINE FLOW ═══════════ */}
        <AnimatedSection>
          <section className={styles.pipeline} id="pipeline">
            <div className={styles.sectionHead}>
              <h2>How Varta Works</h2>
              <p>From event trigger to delivery — a unified, intelligent pipeline.</p>
            </div>
            <div className={styles.pipelineFlow}>
              {pipelineSteps.map((step, i) => (
                <div key={i} className={styles.pipelineStep}>
                  <div className={styles.pipelineIcon}><step.icon size={20} /></div>
                  <span>{step.label}</span>
                  {i < pipelineSteps.length - 1 && (
                    <div className={styles.pipelineArrow}>
                      <div className={styles.arrowDots} />
                      <ArrowRight size={14} />
                    </div>
                  )}
                </div>
              ))}

              <div className={styles.pipelineFan}>
                <div className={styles.fanLines}>
                  {channels.map((_, i) => (
                    <div key={i} className={styles.fanLine} style={{ '--fan-index': i } as React.CSSProperties} />
                  ))}
                </div>
                <div className={styles.channelGrid}>
                  {channels.map((ch, i) => (
                    <div key={i} className={styles.channelChip}>
                      <ch.icon size={14} />
                      <span>{ch.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* ═══════════ FEATURES — STICKY SCROLL-SPY ═══════════ */}
        <section className={styles.features} id="features">
          <div className={styles.sectionHead}>
            <h2>Everything You Need</h2>
            <p>A complete notification platform, not just another API wrapper.</p>
          </div>

          <div className={styles.featuresSplit}>
            {/* Sticky sidebar */}
            <div className={styles.featuresSidebar}>
              <div className={styles.featureNav}>
                {features.map((f, i) => (
                  <button
                    key={f.id}
                    className={`${styles.featureNavItem} ${activeFeature === i ? styles.featureNavActive : ''}`}
                    onClick={() => {
                      featureRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{ '--accent': f.accent } as React.CSSProperties}
                  >
                    <f.icon size={18} />
                    <span>{f.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scrolling feature cards */}
            <div className={styles.featuresContent}>
              {features.map((f, i) => (
                <div
                  key={f.id}
                  ref={(el) => { featureRefs.current[i] = el; }}
                  className={`${styles.featureBlock} ${activeFeature === i ? styles.featureBlockActive : ''}`}
                  style={{ '--accent': f.accent } as React.CSSProperties}
                >
                  <div className={styles.featureBlockIcon}>
                    <f.icon size={28} />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ PRICING ═══════════ */}
        <AnimatedSection>
          <section className={styles.pricing} id="pricing">
            <div className={styles.sectionHead}>
              <h2>Simple, Transparent Pricing</h2>
              <p>Start free. Scale when you're ready. No surprises.</p>
            </div>
            <div className={styles.pricingGrid}>
              {plans.map((p, i) => (
                <div key={i} className={`${styles.priceCard} ${p.featured ? styles.priceCardFeatured : ''}`}>
                  {p.featured && <div className={styles.priceBadge}>Most Popular</div>}
                  <h3>{p.name}</h3>
                  <div className={styles.priceRow}>
                    <span className={styles.priceAmt}>{p.price}</span>
                    <span className={styles.pricePer}>{p.period}</span>
                  </div>
                  <p className={styles.priceDesc}>{p.desc}</p>
                  <ul className={styles.priceFeatures}>
                    {p.features.map((feat, j) => (
                      <li key={j}><Check size={15} /> {feat}</li>
                    ))}
                  </ul>
                  <button className={`${styles.priceBtn} ${p.featured ? styles.priceBtnFeatured : ''}`}>
                    {p.btnLabel} <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </AnimatedSection>

        {/* ═══════════ BOTTOM CTA ═══════════ */}
        <AnimatedSection>
          <section className={styles.bottomCta}>
            <h2>Ready to ship notifications that <span className={styles.heroGradient}>actually work</span>?</h2>
            <p>Join developers building reliable notification infrastructure with Varta.</p>
            <Link href="/signup" className={styles.ctaPrimary}>
              Start Building Free <ArrowRight size={16} />
            </Link>
          </section>
        </AnimatedSection>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <span className={styles.footerVarta}>VARTA</span>
            <span className={styles.footerHindi}>वार्ता</span>
          </div>
          <div className={styles.footerBottom}>
            <div className={styles.footerLinks}>
              <Link href="#">Privacy</Link>
              <Link href="#">Terms</Link>
              <Link href="#">GitHub</Link>
              <Link href="#">Contact</Link>
            </div>
            <span className={styles.footerCopy}>© 2026 Varta. Open Source under MIT.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}