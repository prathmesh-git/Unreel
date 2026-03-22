import { Aperture } from 'lucide-react';

const GithubIcon = () => (
<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
);

const LinkedinIcon = () => (
<svg width="22" height="22" fill="#0A66C2" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
);

const InstagramIcon = () => (
<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
<rect width="24" height="24" rx="5.5" fill="url(#ig-grad)"/>
<path d="M12 7.005a5 5 0 100 10 5 5 0 000-10zm0 8.16a3.16 3.16 0 110-6.32 3.16 3.16 0 010 6.32zm3.64-7.23a1.07 1.07 0 11-2.14 0 1.07 1.07 0 012.14 0z" fill="white"/>
<path fillRule="evenodd" clipRule="evenodd" d="M7 2.5C4.515 2.5 2.5 4.515 2.5 7v10c0 2.485 2.015 4.5 4.5 4.5h10c2.485 0 4.5-2.015 4.5-4.5V7c0-2.485-2.015-4.5-4.5-4.5H7zm12 14.5c0 1.38-1.12 2.5-2.5 2.5H7c-1.38 0-2.5-1.12-2.5-2.5V7c0-1.38 1.12-2.5 2.5-2.5h10c1.38 0 2.5 1.12 2.5 2.5v10z" fill="white"/>
<defs>
<linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
<stop stopColor="#f09433"/>
<stop offset="0.25" stopColor="#e6683c"/>
<stop offset="0.5" stopColor="#dc2743"/>
<stop offset="0.75" stopColor="#cc2366"/>
<stop offset="1" stopColor="#bc1888"/>
</linearGradient>
</defs>
</svg>
);

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-left">
          <span className="logo">
            <span className="logo-icon"><Aperture className="icon" /></span>
            <span>Unreel</span>
          </span>
          <p>Powered by Groq Whisper · LLaMA 3 · Tavily</p>
        </div>
        <div className="footer-socials">
          <a href="https://github.com/prathmesh-git" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="GitHub">
            <GithubIcon />
          </a>
          <a href="https://www.linkedin.com/in/prathmesh-pimpalshende/" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="LinkedIn">
            <LinkedinIcon />
          </a>
          <a href="https://www.instagram.com/praxthm/" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram">
            <InstagramIcon />
          </a>
        </div>
      </div>
    </footer>
  );
}
