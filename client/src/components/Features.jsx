import { ShieldCheck, BarChart2, Globe, Lock } from 'lucide-react';

const FEATURES = [
  { Icon: ShieldCheck, title: 'Fact Verdicts',   desc: 'TRUE / FALSE / MISLEADING / UNVERIFIED with evidence from WHO, Reuters, BBC, and more.' },
  { Icon: BarChart2,   title: 'Bias Meter',       desc: 'See exactly how biased the content is on a 0–100 scale with type detection.' },
  { Icon: Globe,       title: 'Multi-Platform',   desc: 'Works with YouTube Shorts, Instagram Reels, TikTok and more.' },
  { Icon: Lock,        title: 'Secure History',   desc: 'Analysis history is stored in MongoDB so you can fetch recent reports anytime.' },
];

export default function Features() {
  return (
    <section className="features" id="features" aria-labelledby="features-title">
      <h2 id="features-title" className="section-title">Why Unreel?</h2>
      <div className="features-grid">
        {FEATURES.map(({ Icon, title, desc }) => (
          <div className="feature-card" key={title}>
            <div className="feature-icon"><Icon className="icon-xl" /></div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
