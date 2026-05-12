import { ArrowLeft, BookText, Github, Layers3, Plus, Twitter } from 'lucide-react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import profileImg from '../assets/profile.jpg';

const PORTFOLIO_CONFIG = {
  image: profileImg,
  firstName: 'Prathmesh',
  experience: 1,
  domain: 'web development',
  role: 'developers',
  cvLink: 'https://drive.google.com/file/d/1tpnl5CuMwvybLOsUUZxnikgnK5qZRP0l/view?usp=sharing',
  twitterUrl: 'https://x.com/praxthm',
  layersLink: 'https://www.linkedin.com/in/prathmesh-pimpalshende/',
  githubLink: 'https://github.com/prathmesh-git',
};

export default function MiniPortfolio() {
  const config = PORTFOLIO_CONFIG;
  const [isOpen, setIsOpen] = useState(false);
  const [isBio, setIsBio] = useState(false);
  const [isMenu, setIsMenu] = useState(false);
  const isAnimatingRef = useRef(false);

  const controls = useAnimation();
  const imageControls = useAnimation();
  const plusControls = useAnimation();
  const iconsControls = useAnimation();
  const profileControls = useAnimation();
  const aboutControls = useAnimation();
  const menuControls = useAnimation();

  const containerVariants = {
    closed: { width: '3.75rem', height: '2rem', minWidth: '3.75rem' },
    open: { width: '16rem', height: '3.5rem', minWidth: '16rem' },
    bio: { width: '22.8rem', height: '11.9rem', minWidth: '22rem' },
    menu: { width: '10.25rem', height: '2rem', minWidth: '10.25rem' },
  };

  const aboutVariants = {
    closed: { opacity: 0, scale: 0.5 },
    bio: { opacity: 1, scale: 1 },
  };

  const imageVariants = {
    closed: { width: '24px', height: '24px', translateX: 0, opacity: 1 },
    open: { width: '2.2rem', height: '2.2rem', translateX: '4px', opacity: 1 },
    bio: { opacity: 0, translateX: '-3px' },
  };

  const plusVariants = {
    closed: { opacity: 1 },
    open: { opacity: 0 },
  };

  const iconsVariants = {
    closed: { opacity: 0, gap: '2px' },
    open: { opacity: 1, gap: '4px' },
  };

  const profileVariants = {
    closed: { scale: 0.5, left: '40px', opacity: 0, filter: 'blur(4px)', y: '-50%' },
    open: { scale: 1, left: '3.25rem', opacity: 1, filter: 'blur(0)', y: '-50%' },
  };

  const menuVariants = {
    closed: { opacity: 0, scale: 0, y: '-50%' },
    menu: { opacity: 1, scale: 1, y: '-50%' },
  };

  useEffect(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const sequence = async () => {
      const state =
        isOpen && !isBio
          ? 'openButBioClosed'
          : isOpen && isBio
            ? 'openButBioOpen'
            : isMenu && !isOpen && !isBio
              ? 'menuOpened'
              : !isOpen && !isBio
                ? 'closedButBioClosed'
                : !isOpen && isBio
                  ? 'closedButBioOpen'
                  : null;

      switch (state) {
        case 'openButBioClosed': {
          aboutControls.start('closed');
          plusControls.start('open');
          imageControls.start('open');
          menuControls.start('closed');
          await controls.start('open');
          await Promise.all([iconsControls.start('open'), profileControls.start('open')]);
          break;
        }
        case 'closedButBioClosed': {
          await aboutControls.start('closed');
          menuControls.start('closed');
          await Promise.all([profileControls.start('closed'), iconsControls.start('closed')]);
          await Promise.all([
            controls.start('closed'),
            imageControls.start('closed'),
            plusControls.start('closed'),
          ]);
          break;
        }
        case 'openButBioOpen': {
          imageControls.start('bio');
          menuControls.start('closed');
          await Promise.all([
            plusControls.start('open'),
            profileControls.start('closed'),
            iconsControls.start('closed'),
          ]);
          await Promise.all([controls.start('bio'), aboutControls.start('bio')]);
          break;
        }
        case 'menuOpened': {
          await Promise.all([
            imageControls.start('bio'),
            profileControls.start('closed'),
            iconsControls.start('closed'),
          ]);
          await Promise.all([controls.start('menu'), menuControls.start('menu')]);
          break;
        }
      }
      isAnimatingRef.current = false;
    };

    sequence();
  }, [isOpen, controls, imageControls, plusControls, iconsControls, profileControls, aboutControls, isBio, isMenu, menuControls]);

  return (
    <div className="mp-wrapper" id="mini-portfolio">
      <motion.div
        variants={containerVariants}
        initial="closed"
        animate={controls}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mp-container"
      >
        {/* Avatar / toggle pill */}
        <div className="mp-avatar-area">
          <motion.div
            variants={imageVariants}
            initial="closed"
            animate={imageControls}
            onClick={() => { if (!isAnimatingRef.current) setIsOpen(prev => !prev); }}
            className="mp-avatar-motion"
          >
            {config.image ? (
              <img alt="me" src={config.image} width={42} height={42} className="mp-avatar-img" />
            ) : (
              <div className="mp-avatar-fallback">
                <span className="mp-avatar-letter">{config.firstName?.substring(0, 1)}</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Plus icon (collapsed state) */}
        <motion.div
          variants={plusVariants}
          initial="closed"
          animate={plusControls}
          className="mp-plus-btn"
        >
          <Plus size={16} color="white" />
        </motion.div>

        {/* Action icons (expanded state) */}
        <motion.div
          variants={iconsVariants}
          initial="closed"
          animate={iconsControls}
          className="mp-action-icons"
        >
          <div
            onClick={() => { if (!isAnimatingRef.current) setIsBio(true); }}
            className="mp-action-btn mp-action-bio"
          >
            <div className="mp-bar" style={{ height: '4px' }} />
            <div className="mp-bar" style={{ height: '8px' }} />
            <div className="mp-bar" style={{ height: '14px' }} />
            <div className="mp-bar" style={{ height: '5px' }} />
            <div className="mp-bar" style={{ height: '10px' }} />
            <div className="mp-bar" style={{ height: '5px' }} />
          </div>
          <div
            onClick={() => {
              if (!isAnimatingRef.current) {
                setIsMenu(true);
                setIsBio(false);
                setIsOpen(false);
              }
            }}
            className="mp-action-btn mp-action-menu"
          >
            <div className="mp-dot" />
            <div className="mp-dot" />
            <div className="mp-dot" />
          </div>
        </motion.div>

        {/* Name / greeting (expanded state) */}
        <AnimatePresence>
          <motion.div
            key="profile"
            variants={profileVariants}
            initial="closed"
            animate={profileControls}
            exit="closed"
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mp-profile-info"
          >
            <span className="mp-greeting">{"Hello, I'm"}</span>
            <h1 className="mp-name">{config.firstName}</h1>
          </motion.div>
        </AnimatePresence>

        {/* Bio panel */}
        <motion.div
          variants={aboutVariants}
          initial="closed"
          animate={aboutControls}
          onClick={() => { if (!isAnimatingRef.current) setIsBio(false); }}
          className="mp-bio-panel"
        >
          <div className="mp-bio-content">
            <p className="mp-bio-text">
              I recently dove into <span className="mp-bio-hl">web development</span> and
              already have clear principles, the main one being{' '}
              <span className="mp-bio-hl">&ldquo;value instead of mindless execution&rdquo;</span>.
              It&apos;s easy to print generic solutions, but what we{' '}
              {config.role} are hired for is our unique point of view and creative
              thinking. Usability combined with aesthetics is the key.
            </p>
          </div>
        </motion.div>

        {/* Menu links */}
        <motion.div
          variants={menuVariants}
          initial="closed"
          animate={menuControls}
          className="mp-menu-links"
        >
          <div className="mp-menu-inner">
            <div
              onClick={() => {
                if (!isAnimatingRef.current) {
                  setIsMenu(false);
                  setIsOpen(true);
                }
              }}
              className="mp-menu-back"
            >
              <ArrowLeft size={16} color="white" />
            </div>
            <a href={config.cvLink} target="_blank" rel="noopener noreferrer">
              <BookText size={16} color="white" style={{ transform: 'rotate(30deg)' }} />
            </a>
            <a href={config.twitterUrl} target="_blank" rel="noopener noreferrer">
              <Twitter size={16} color="white" />
            </a>
            <a href={config.layersLink} target="_blank" rel="noopener noreferrer">
              <Layers3 size={16} color="white" style={{ transform: 'rotate(30deg)' }} />
            </a>
            <a href={config.githubLink} target="_blank" rel="noopener noreferrer">
              <Github size={16} color="white" />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
