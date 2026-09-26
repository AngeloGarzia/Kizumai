import {
  FEASIBILITY_SEGMENT_COUNT,
  feasibilityLabel,
  feasibilityRoundPillStyle,
  feasibilitySegmentFillColor,
  feasibilitySegments,
} from './FeasibilityGauge.jsx';
import { metricPillPulseMs, metricPillSize } from '../utils/metricPillSize.js';
import { IconFeasibility } from './icons.jsx';

/**
 * Pastille réussite : icône coupe + 6 segments rouge → vert.
 */
export default function FeasibilityRoundPill({
  score,
  className = '',
  size = 'md',
  onClick = null,
}) {
  const filled = feasibilitySegments(score);
  const fill = feasibilitySegmentFillColor(score);
  const label = feasibilityLabel(score);
  const s = metricPillSize(size);
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'span';
  const wrapStyle = {
    ...feasibilityRoundPillStyle(score),
    '--pill-pulse-ms': `${metricPillPulseMs(score)}ms`,
  };

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
      title={
        clickable
          ? `Faisabilité ${label} — cliquez pour le détail`
          : `Faisabilité : ${label}`
      }
      aria-label={
        filled == null
          ? 'Faisabilité non disponible'
          : `Faisabilité ${label} : ${filled} sur ${FEASIBILITY_SEGMENT_COUNT}`
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
        <IconFeasibility className={s.icon} />
      </span>
      <span className={s.mid} aria-hidden="true">
        {Array.from({ length: FEASIBILITY_SEGMENT_COUNT }, (_, i) => {
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
        {filled == null ? 'n/d' : `${filled}/${FEASIBILITY_SEGMENT_COUNT}`}
      </span>
    </Tag>
  );
}
