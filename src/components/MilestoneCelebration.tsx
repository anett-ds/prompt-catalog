import { useState, useEffect } from 'react';
import './MilestoneCelebration.scss';

export interface Milestone {
  count: number;
  msg: string;
}

interface Props {
  milestone: Milestone | null;
}

export function MilestoneCelebration({ milestone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!milestone) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [milestone]);

  if (!milestone) return null;

  return (
    <div className={`milestone${visible ? ' milestone--visible' : ''}`}>
      <div className="milestone__content">
        <span className="milestone__emoji">🐱</span>
        <div className="milestone__text">
          <div className="milestone__count">
            {milestone.count} {milestone.count === 1 ? 'prompt' : 'prompts'} copied!
          </div>
          <div className="milestone__msg">{milestone.msg}</div>
        </div>
      </div>
    </div>
  );
}
