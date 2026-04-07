import { useState, useEffect, useRef } from 'react';
import { BarChart2, TrendingUp, Activity } from 'lucide-react';

function AnimatedCounter({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref} className="stats-counter">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export default function StatsSection() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/top-analysed/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStats(data.stats);
        else setError(true);
      })
      .catch(() => setError(true));
  }, []);

  if (error || !stats) return null;

  const cards = [
    {
      icon: Activity,
      label: 'Total Analyses',
      value: stats.totalAnalyses,
      suffix: '',
      color: 'var(--purple-2)',
    },
    {
      icon: TrendingUp,
      label: 'Avg Truth Score',
      value: stats.averageTruthScore,
      suffix: '%',
      color: 'var(--true-color)',
    },
    {
      icon: BarChart2,
      label: 'Avg Bias Score',
      value: stats.averageBiasScore,
      suffix: '%',
      color: 'var(--misleading-color)',
    },
    {
      icon: Activity,
      label: 'Analysed Today',
      value: stats.analysesToday,
      suffix: '',
      color: 'var(--cyan-2)',
    },
  ];

  return (
    <section className="stats-section" id="stats" aria-labelledby="stats-title">
      <h2 id="stats-title" className="section-title">Platform Statistics</h2>
      <p className="section-subtitle">Real-time insights from our analysis engine</p>
      <div className="stats-grid">
        {cards.map(({ icon: Icon, label, value, suffix, color }) => (
          <div className="stats-card" key={label}>
            <div className="stats-card-icon" style={{ color }}>
              <Icon className="icon-xl" />
            </div>
            <div className="stats-card-value" style={{ color }}>
              <AnimatedCounter target={value} suffix={suffix} />
            </div>
            <div className="stats-card-label">{label}</div>
          </div>
        ))}
      </div>
      {stats.mostCommonBiasLevel && stats.mostCommonBiasLevel !== 'None' && (
        <div className="stats-common-bias">
          Most Common Bias Level: <span>{stats.mostCommonBiasLevel}</span>
        </div>
      )}
    </section>
  );
}
