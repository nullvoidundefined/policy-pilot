import Captain from '@/components/Captain/Captain';
import Image from 'next/image';
import Link from 'next/link';

import styles from './page.module.scss';

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* ───── Hero ───── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>
            <Image
              src='/logo.svg'
              alt='PolicyPilot'
              width={240}
              height={54}
              priority
            />
          </div>

          <Captain
            diverse
            size='lg'
            alt='Captain PolicyPilot — your co-pilot for company policy'
            className={styles.heroCaptain}
          />

          <h1 className={styles.heroTitle}>
            Ask your company handbook{' '}
            <span className={styles.heroTitleAccent}>anything.</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Your co-pilot for company policy. Upload any handbook, ask a
            question in plain English, and get instant answers with source
            citations.
          </p>

          <div className={styles.heroActions}>
            <Link href='/demo' className={styles.btnPrimary}>
              Try the Demo
            </Link>
            <Link href='/register' className={styles.btnSecondary}>
              Get Started
            </Link>
          </div>
        </div>

        <div className={styles.heroStripe} aria-hidden='true' />
      </section>

      {/* ───── Features ───── */}
      <section className={styles.features}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>All systems go</h2>
          <p className={styles.sectionSubtitle}>
            Everything you need to navigate company policy — fast, accurate, and
            citation-approved.
          </p>

          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon} aria-hidden='true'>
                ✈
              </div>
              <h3 className={styles.featureTitle}>Instant Answers</h3>
              <p className={styles.featureText}>
                Ask questions in plain English, get answers in seconds. No more
                digging through 200-page PDFs.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIcon} aria-hidden='true'>
                📋
              </div>
              <h3 className={styles.featureTitle}>Cited Sources</h3>
              <p className={styles.featureText}>
                Every answer includes citations back to the source document.
                Trust, but verify — flight-tested and citation-approved.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIcon} aria-hidden='true'>
                🔒
              </div>
              <h3 className={styles.featureTitle}>Your Documents, Secured</h3>
              <p className={styles.featureText}>
                Upload PDFs, DOCX, or any policy document format. Your data
                stays private — no shared cabins here.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ───── Demo Preview ───── */}
      <section className={styles.demo}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>
            Try it with real company handbooks
          </h2>
          <p className={styles.sectionSubtitle}>
            We&apos;ve pre-loaded handbooks from three well-known companies.
            Take PolicyPilot for a spin — no signup required.
          </p>

          <div className={styles.demoGrid}>
            <Link href='/demo' className={styles.demoCard}>
              <div className={styles.demoCardLabel}>Handbook</div>
              <h3 className={styles.demoCardTitle}>GitLab</h3>
              <p className={styles.demoCardText}>
                Remote work policies, engineering culture, and one of the most
                comprehensive public handbooks in tech.
              </p>
              <span className={styles.demoCardCta}>Explore →</span>
            </Link>

            <Link href='/demo' className={styles.demoCard}>
              <div className={styles.demoCardLabel}>Handbook</div>
              <h3 className={styles.demoCardTitle}>Valve</h3>
              <p className={styles.demoCardText}>
                The legendary flat-hierarchy handbook. No managers, desk wheels,
                and a culture unlike any other.
              </p>
              <span className={styles.demoCardCta}>Explore →</span>
            </Link>

            <Link href='/demo' className={styles.demoCard}>
              <div className={styles.demoCardLabel}>Handbook</div>
              <h3 className={styles.demoCardTitle}>Basecamp</h3>
              <p className={styles.demoCardText}>
                Opinionated takes on work-life balance, calm company principles,
                and benefits that actually make sense.
              </p>
              <span className={styles.demoCardCta}>Explore →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ───── CTA Footer ───── */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <Captain
            diverse
            size='md'
            alt='Captain PolicyPilot giving a thumbs up'
            className={styles.ctaCaptain}
          />
          <h2 className={styles.ctaTitle}>Ready for takeoff?</h2>
          <p className={styles.ctaText}>
            Create your free account and start asking your handbook anything —
            answers in seconds, sources included.
          </p>
          <Link href='/register' className={styles.btnPrimary}>
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
