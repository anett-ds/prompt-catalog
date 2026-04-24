import './Copycat.scss';

interface Props {
  visible: boolean;
}

export function Copycat({ visible }: Props) {
  return (
    <div className={`copycat${visible ? ' copycat--visible' : ''}`}>
      <div className="copycat__icon">🐱</div>
      <div className="copycat__label">copied!</div>
    </div>
  );
}
