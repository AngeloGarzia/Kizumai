import {
  COMPETITION_SEGMENT_COUNT,
  competitionDisplayLabel,
  competitionRoundPillStyle,
  competitionSegmentFillColor,
  competitionSegments,
  normalizeCompetition,
} from '../utils/competitionPill.js';
import { metricPillPulseMs, metricPillSize } from '../utils/metricPillSize.js';
import { IconCompetition } from './icons.jsx';

/**
 * Pastille concurrence : icône + 6 segments vert → marron.
 */
export default function CompetitionSegmentsPill({
  competition,
  title,
  className = '',
  size = 'md',
  onClick = null,
}) {
  const c = normalizeCompetition(competition);
  const score = c?.score;
  const filled = competitionSegments(score);
  const wrapStyle = {
    ...competitionRoundPillStyle(score),
    '--pill-pulse-ms': `${metricPillPulseMs(score)}ms`,
  };
  const fill = competitionSegmentFillColor(score);
  const label = competitionDisplayLabel(c);
  const s = metricPillSize(size);
  const clickable = typeof onClick === 'function';

  const Tag = clickable ? 'button' : 'span';

  return (
    <Tag
      type={clickable ? 'button' : undefined}
      className={[
        'inline-flex flex-col items-center justify-center rounded-full border metric-pill-blink',
        clickable ? 'cursor-pointer hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-prune-300' : '',
        s.wrap,
        className,
      ].join(' ')}
      style={wrapStyle}
      title={title || [label, c?.note].filter(Boolean).join(' — ') || 'Concurrence'}
      aria-label={
        filled == null
          ? 'Concurrence non disponible'
          : `Concurrence ${label} : ${filled} sur ${COMPETITION_SEGMENT_COUNT}`
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
        <IconCompetition className={s.icon} />
      </span>
      <span className={s.mid} aria-hidden="true">
        {Array.from({ length: COMPETITION_SEGMENT_COUNT }, (_, i) => {
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
        {filled == null ? 'n/d' : `${filled}/${COMPETITION_SEGMENT_COUNT}`}
      </span>
    </Tag>
  );
}
