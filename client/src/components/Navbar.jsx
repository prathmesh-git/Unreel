import { Aperture } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        <a href="/" className="logo">
          <span className="logo-icon"><Aperture className="icon-lg" /></span>
          <span>Unreel</span>
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it Works</a>
          <a href="#features">Features</a>
        </div>
      </div>
    </nav>
  );
}
