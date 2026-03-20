"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  const reduceMotion = useReducedMotion();

  const reveal = {
    initial: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28 },
    whileInView: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    transition: { duration: 0.7 },
    viewport: { once: true, amount: 0.25 },
  };

  const proofItems = [
    "Grounded on your files",
    "Session-aware chat",
    "PDF, PPTX, and TXT support",
    "Follow-up prompts built in",
  ];

  const workflowSteps = [
    {
      index: "01",
      title: "Bring the source in",
      body: "Drop in the files you already work with so every answer starts from real material instead of guesswork.",
    },
    {
      index: "02",
      title: "Ask naturally",
      body: "Use plain language, layer follow-up questions, and keep the thread moving without re-explaining context every time.",
    },
    {
      index: "03",
      title: "Stay grounded",
      body: "Whiteboard keeps the conversation anchored to the uploaded document context so responses stay practical and relevant.",
    },
  ];

  const featureCards = [
    {
      eyebrow: "Clarity",
      title: "Answers that start from evidence",
      body: "Turn long documents into fast, readable responses without manually searching through every page.",
    },
    {
      eyebrow: "Continuity",
      title: "Context that carries forward",
      body: "Session history and pinned files make longer working conversations feel steady instead of repetitive.",
    },
    {
      eyebrow: "Momentum",
      title: "Follow-ups without friction",
      body: "Suggested prompts and lightweight file management help users keep digging without breaking focus.",
    },
  ];

  return (
    <main className="landing-page">
      <div className="landing-noise" aria-hidden="true" />

      <motion.header
        className="landing-hero"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <nav className="landing-nav">
          <div>
            <p className="landing-brand-mark">Whiteboard</p>
            <p className="landing-brand-subtitle">Editorial AI workspace</p>
          </div>
          <div className="landing-nav-actions">
            <a href="#workflow" className="landing-nav-link">
              How it works
            </a>
            <Link href="/chat" className="landing-button landing-button-secondary">
              Open app
            </Link>
          </div>
        </nav>

        <section className="landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-kicker">Grounded document intelligence</p>
            <h1>Chat with your files and get answers that stay close to the source.</h1>
            <p className="landing-lead">
              Whiteboard turns dense PDFs, slides, and text files into a focused
              conversation workspace built for fast reading, follow-up questions,
              and cleaner decision making.
            </p>

            <div className="landing-hero-actions">
              <Link href="/chat" className="landing-button landing-button-primary">
                Start with your files
              </Link>
              <a href="#demo" className="landing-button landing-button-ghost">
                See the flow
              </a>
            </div>

            <div className="landing-proof-strip">
              {proofItems.map((item) => (
                <span key={item} className="landing-proof-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <motion.div
            className="landing-hero-panel"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.12, ease: "easeOut" }}
          >
            <div className="landing-product-window">
              <div className="landing-window-topbar">
                <span />
                <span />
                <span />
              </div>

              <div className="landing-window-layout">
                <aside className="landing-window-sidebar">
                  <p>Session</p>
                  <ul>
                    <li className="is-active">Board brief.pdf</li>
                    <li>Product notes.txt</li>
                    <li>Quarterly review.pptx</li>
                  </ul>
                </aside>

                <div className="landing-window-main">
                  <div className="landing-window-card">
                    <span className="landing-window-label">Prompt</span>
                    <p>Summarize the main risks across these files and suggest three follow-up questions.</p>
                  </div>

                  <div className="landing-window-card landing-window-card-answer">
                    <span className="landing-window-label">Response</span>
                    <p>
                      The documents point to delivery risk, uneven ownership, and
                      unresolved dependencies. The strongest next questions are around
                      deadlines, decision-makers, and missing inputs.
                    </p>
                  </div>

                  <div className="landing-window-footer">
                    <span>Context loaded</span>
                    <span>Suggested follow-ups ready</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </motion.header>

      <motion.section className="landing-section landing-intro-band" {...reveal}>
        <div className="landing-stateline">
          <div>
            <span>Purpose</span>
            <p>Move from scattered documents to focused understanding.</p>
          </div>
          <div>
            <span>Why it works</span>
            <p>Users trust products that show their reasoning begins with real source material.</p>
          </div>
        </div>
      </motion.section>

      <motion.section id="workflow" className="landing-section landing-workflow" {...reveal}>
        <div className="landing-section-heading">
          <p>Workflow</p>
          <h2>A simple path from upload to insight.</h2>
        </div>

        <div className="landing-workflow-grid">
          {workflowSteps.map((step) => (
            <article key={step.index} className="landing-step-card">
              <span className="landing-step-index">{step.index}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </motion.section>

      <motion.section id="demo" className="landing-section landing-demo" {...reveal}>
        <div className="landing-section-heading">
          <p>Product flow</p>
          <h2>Designed to feel calm, readable, and in motion.</h2>
        </div>

        <div className="landing-demo-grid">
          <article className="landing-demo-script">
            <div className="landing-demo-line">
              <span>Upload</span>
              <p>Bring in the files that matter right now.</p>
            </div>
            <div className="landing-demo-line">
              <span>Ask</span>
              <p>Phrase questions naturally, from summaries to targeted follow-ups.</p>
            </div>
            <div className="landing-demo-line">
              <span>Refine</span>
              <p>Use suggested prompts and pinned files to keep momentum without losing context.</p>
            </div>
          </article>

          <div className="landing-demo-stack">
            <div className="landing-demo-card landing-demo-card-upload">
              <p className="landing-demo-card-label">Files ready</p>
              <strong>3 sources attached</strong>
              <span>PDF, PPTX, TXT</span>
            </div>
            <div className="landing-demo-card landing-demo-card-prompt">
              <p className="landing-demo-card-label">Question</p>
              <strong>What are the biggest blockers across these documents?</strong>
            </div>
            <div className="landing-demo-card landing-demo-card-answer">
              <p className="landing-demo-card-label">Grounded answer</p>
              <strong>Whiteboard identifies the recurring risks and turns them into clear next actions.</strong>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section className="landing-section landing-features" {...reveal}>
        <div className="landing-section-heading">
          <p>Benefits</p>
          <h2>Minimal interface, practical outcomes.</h2>
        </div>

        <div className="landing-feature-grid">
          {featureCards.map((feature) => (
            <article key={feature.title} className="landing-feature-card">
              <span>{feature.eyebrow}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </motion.section>

      <motion.section className="landing-section landing-cta" {...reveal}>
        <p className="landing-kicker">Ready to work from the source?</p>
        <h2>Open Whiteboard and start asking better questions.</h2>
        <p className="landing-cta-copy">
          Built for people who need clean answers from real documents without the noise.
        </p>
        <Link href="/chat" className="landing-button landing-button-primary">
          Launch the workspace
        </Link>
      </motion.section>
    </main>
  );
}
