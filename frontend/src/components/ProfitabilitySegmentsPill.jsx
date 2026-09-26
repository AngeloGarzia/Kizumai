import {
  PROFITABILITY_SEGMENT_COUNT,
  normalizeProfitability,
  profitabilityDisplayLabel,
  profitabilityRoundPillStyle,
  profitabilitySegmentFillColor,
  profitabilitySegments,
} from '../utils/profitabilityPill.js';
import { IconProfitability } from './icons.jsx';

/**
 * Pastille rentabilité : icône $ + 6 segments taupe → or → vert.
 */
export default function ProfitabilitySegmentsPill({
  profitability,
  title,
  className = '',
  size = 'md',
}) {
  const p = normalizeProfitability(profitability);
  const score = p?.score;
  const filled = profitabilitySegments(score);
  const wrapStyle = profitabilityRoundPillStyle(score);
  const fill = profitabilitySegmentFillColor(score);
  const label = profitabilityDisplayLabel(p);
  const isSm = size === 'sm';

  return (
    <span
      className={[
        'inline-flex flex-col items-center justify-center rounded-full border',
        isSm ? 'h-11 w-11 gap-0.5 px-1' : 'h-16 w-16 gap-0.5 px-1.5 py-1',
        className,
      ].join(' ')}
      style={wrapStyle}
      title={title || [label, p?.note].filter(Boolean).join(' — ') || 'Rentabilité'}
      aria-label={
        filled == null
          ? 'Rentabilité non disponible'
          : `Rentabilité ${label} : ${filled} sur ${PROFITABILITY_SEGMENT_COUNT}`
      }
    >
      <IconProfitability className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span
        className={['flex items-end justify-center', isSm ? 'gap-px h-3.5' : 'gap-0.5 h-5'].join(' ')}
        aria-hidden="true"
      >
        {Array.from({ length: PROFITABILITY_SEGMENT_COUNT }, (_, i) => {
          const on = filled != null && i < filled;
          const h = isSm ? 5 + i * 1.2 : 6 + i * 1.6;
          return (
            <span
              key={i}
              className="w-1 rounded-sm"
              style={{
                height: `${h}px`,
                backgroundColor: on ? fill : 'rgba(255,255,255,0.55)',
                opacity: on ? 1 : 0.55,
              }}
            />
          );
        })}
      </span>
      <span
        className={[
          'font-bold leading-none tracking-tight',
          isSm ? 'text-[7px]' : 'text-[9px]',
        ].join(' ')}
      >
        {filled == null ? 'n/d' : `${filled}/${PROFITABILITY_SEGMENT_COUNT}`}
      </span>
    </span>
  );
}
