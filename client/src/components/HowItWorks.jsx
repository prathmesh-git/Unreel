import { Link2, Mic, Search, Zap } from 'lucide-react';

const STEPS = [
  { num: '01', Icon: Link2,  title: 'Paste the Link',    desc: 'Drop any reel or short video URL from any platform.' },
  { num: '02', Icon: Mic,    title: 'AI Transcribes',    desc: 'OpenAI Whisper converts the audio to text with high accuracy.' },
  { num: '03', Icon: Search, title: 'Claims Extracted',  desc: 'An LLM identifies every verifiable factual claim in the video.' },
  { num: '04', Icon: Zap,    title: 'Verdict Delivered', desc: 'Each claim is fact-checked against trusted sources. Bias is measured.' },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works" aria-labelledby="how-title">
      <h2 id="how-title" className="section-title">How It Works</h2>
      <p className="section-subtitle">Four AI-powered steps in under 60 seconds</p>
      <div className="steps-grid">
        {STEPS.map(({ num, Icon, title, desc }) => (
          <div className="step-card" key={num}>
            <div className="step-number" aria-hidden="true">{num}</div>
            <div className="step-icon"><Icon className="icon-lg" /></div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
