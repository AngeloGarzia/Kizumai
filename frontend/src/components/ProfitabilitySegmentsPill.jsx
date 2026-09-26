import {
  PROFITABILITY_SEGMENT_COUNT,
  normalizeProfitability,
  profitabilityDisplayLabel,
  profitabilityRoundPillStyle,
  profitabilitySegmentFillColor,
  profitabilitySegments,
} from '../utils/profitabilityPill.js';
import { metricPillPulseMs, metricPillSize } from '../utils/metricPillSize.js';
import { IconProfitability } from './icons.jsx';

/**
 * Pastille rentabilité : icône $ + 6 segments taupe → or → vert.
 */
export default function ProfitabilitySegmentsPill({
  profitability,
  title,
  className = '',
  size = 'md',
  onClick = null,
}) {
  const p = normalizeProfitability(profitability);
  const score = p?.score;
  const filled = profitabilitySegments(score);
  const wrapStyle = {
    ...profitabilityRoundPillStyle(score),
    '--pill-pulse-ms': `${metricPillPulseMs(score)}ms`,
  };
  const fill = profitabilitySegmentFillColor(score);
  const label = profitabilityDisplayLabel(p);
  const s = metricPillSize(size);
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'span';

  return (
    <Tag
      type={clickable ? 'button' : undefined}
      className={[
        'inline-flex flex-col items-center justify-center rounded-full border metric-pill-blink',
        clickable
          ? 'cursor-pointer hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-prune-300'
          : '',
        s.wrap,
        className,
      ].join(' ')}
      style={wrapStyle}
      title={title || [label, p?.note].filter(Boolean).join(' — ') || 'Rentabilité'}
      aria-label={
        filled == null
          ? 'Rentabilité non disponible'
          : `Rentabilité ${label} : ${filled} sur ${PROFITABILITY_SEGMENT_COUNT}`
      }
      onClick={
        clickable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick(e);
            }
          : undefined
      }
    >
      <span className={s.iconSlot}>
        <IconProfitability className={s.icon} />
      </span>
      <span className={s.mid} aria-hidden="true">
        {Array.from({ length: PROFITABILITY_SEGMENT_COUNT }, (_, i) => {
          const on = filled != null && i < filled;
          const h = s.segBase + i * s.segStep;
          return (
            <span
              key={i}
              className={`${s.segWidth} rounded-sm`}
              style={{
                height: `${h}px`,
                backgroundColor: on ? fill : 'rgba(255,255,255,0.55)',
                opacity: on ? 1 : 0.55,
              }}
            />
          );
        })}
      </span>
      <span className={s.foot}>
        {filled == null ? 'n/d' : `${filled}/${PROFITABILITY_SEGMENT_COUNT}`}
      </span>
    </Tag>
  );
}
