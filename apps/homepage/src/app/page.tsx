"use client";

import { useState } from "react";

const NAV_ITEMS = [
  { label: "Mission", href: "#mission" },
  { label: "事業内容", href: "#services" },
  { label: "会社概要", href: "#company" },
  { label: "お問い合わせ", href: "#contact" },
];

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="header">
      <div className="container header-inner">
        <a href="/" className="logo">
          Meliorra<span>.</span>
        </a>
        <button
          className="nav-toggle"
          onClick={() => setOpen(!open)}
          aria-label="メニューを開く"
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`nav${open ? " open" : ""}`}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a href="#contact" className="nav-cta" onClick={() => setOpen(false)}>
            Get in touch
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="container hero-content">
        <span className="hero-label">Meliorra Inc.</span>
        <h1>
          <em>責任ある進化</em>で、
          <br />
          未来を紡ぐ
        </h1>
        <p className="hero-sub">
          AI技術を活用した意思決定支援と事業構築を通じて、
          責任ある意思決定が最も価値を生む世界を創造します。
        </p>
        <div className="hero-actions">
          <a href="#contact" className="btn btn-primary btn-arrow">
            お問い合わせ
          </a>
          <a href="#services" className="btn btn-outline">
            事業内容を見る
          </a>
        </div>
      </div>
    </section>
  );
}

function MissionVision() {
  return (
    <section className="section mv-section" id="mission">
      <div className="container">
        <span className="section-label">Mission & Vision</span>
        <div className="mv-grid">
          <div className="mv-item">
            <p className="mv-label">Mission</p>
            <p className="mv-text">責任ある進化で、未来を紡ぐ</p>
          </div>
          <div className="mv-item">
            <p className="mv-label">Vision</p>
            <p className="mv-text">
              責任ある意思決定が最も価値を生む世界
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const SERVICES = [
  {
    icon: "01",
    title: "AI意思決定支援",
    desc: "AIを活用した構造化された意思決定プロセスにより、経営判断の質とスピードを向上させます。",
  },
  {
    icon: "02",
    title: "事業構築OS",
    desc: "会社設立から運営まで、事業構築に必要な一連のプロセスをシステム化し、効率的な経営基盤を提供します。",
  },
  {
    icon: "03",
    title: "プロダクト開発",
    desc: "最新技術を活用したプロダクト開発で、ビジネス課題を解決するソリューションを構築します。",
  },
];

function Services() {
  return (
    <section className="section" id="services">
      <div className="container">
        <span className="section-label">What We Do</span>
        <h2 className="section-title">
          テクノロジーで、
          <br />
          ビジネスの未来を創る
        </h2>
        <p className="section-desc">
          AI技術と事業構築の知見を組み合わせ、企業の持続的な成長を支援します。
        </p>
        <div className="services-grid">
          {SERVICES.map((s) => (
            <div key={s.title} className="service-card">
              <span className="service-icon">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompanyInfo() {
  return (
    <section className="section" id="company">
      <div className="container">
        <span className="section-label">Company</span>
        <h2 className="section-title">会社概要</h2>
        <dl className="company-grid">
          <div className="company-item">
            <dt>会社名</dt>
            <dd>Meliorra株式会社</dd>
          </div>
          <div className="company-item">
            <dt>代表者</dt>
            <dd>代表取締役　萩原　康仁</dd>
          </div>
          <div className="company-item">
            <dt>所在地</dt>
            <dd>
              〒104-0061
              <br />
              東京都中央区銀座1-12-4 N&E BLD.7階
            </dd>
          </div>
          <div className="company-item">
            <dt>電話番号</dt>
            <dd>
              <a href="tel:050-3696-1474">050-3696-1474</a>
            </dd>
          </div>
          <div className="company-item">
            <dt>メール</dt>
            <dd>
              <a href="mailto:privacy@meliorra.co">privacy@meliorra.co</a>
            </dd>
          </div>
          <div className="company-item">
            <dt>設立</dt>
            <dd>2026年</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function ContactCTA() {
  return (
    <section className="section cta-section" id="contact">
      <div className="container cta-inner">
        <span className="section-label">Contact</span>
        <h2 className="section-title">お気軽にご相談ください</h2>
        <p className="section-desc">
          事業構築やAI活用に関するご相談を承っております。
          まずはお気軽にお問い合わせください。
        </p>
        <div className="cta-actions">
          <a
            href="mailto:privacy@meliorra.co"
            className="btn btn-primary btn-arrow"
          >
            メールで問い合わせ
          </a>
          <a href="tel:050-3696-1474" className="btn btn-outline">
            050-3696-1474
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} Meliorra株式会社
        </p>
        <div className="footer-links">
          <a href="/privacy">プライバシーポリシー</a>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <MissionVision />
        <Services />
        <CompanyInfo />
        <ContactCTA />
      </main>
      <Footer />
    </>
  );
}
