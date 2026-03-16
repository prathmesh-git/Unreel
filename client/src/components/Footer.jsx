import { Aperture } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="logo">
          <span className="logo-icon"><Aperture className="icon" /></span>
          <span>Unreel</span>
        </span>
        <p>Powered by Groq Whisper · LLaMA 3 · Tavily</p>
      </div>
    </footer>
  );
}
