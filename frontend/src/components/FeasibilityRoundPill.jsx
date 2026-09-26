import { feasibilityRoundPillStyle } from './FeasibilityGauge.jsx';
import { IconFeasibility } from './icons.jsx';

/**
 * Pastille réussite : icône cible + pourcentage.
 */
export default function FeasibilityRoundPill({ score, className = '', size = 'md' }) {
  const isSm = size === 'sm';
  const ready = score != null && !Number.isNaN(Number(score));

  return (
    <span
      className={[
        'inline-flex flex-col items-center justify-center rounded-full border',
        isSm ? 'h-11 w-11 gap-0.5' : 'h-16 w-16 gap-0.5 py-1',
        className,
      ].join(' ')}
      style={feasibilityRoundPillStyle(score)}
      title="Chance de réussite estimée"
      aria-label={ready ? `Réussite estimée ${score} %` : 'Réussite non disponible'}
    >
      <IconFeasibility className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span
        className={[
          'font-bold tabular-nums leading-none',
          isSm ? 'text-[11px]' : 'text-[15px]',
        ].join(' ')}
      >
        {ready ? `${Math.round(Number(score))}%` : '—'}
      </span>
    </span>
  );
}
