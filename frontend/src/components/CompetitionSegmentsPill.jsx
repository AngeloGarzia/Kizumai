import {
  COMPETITION_SEGMENT_COUNT,
  competitionDisplayLabel,
  competitionRoundPillStyle,
  competitionSegmentFillColor,
  competitionSegments,
  normalizeCompetition,
} from '../utils/competitionPill.js';
import { IconCompetition } from './icons.jsx';

/**
 * Pastille concurrence : icône + 6 segments vert → marron.
 */
export default function CompetitionSegmentsPill({
  competition,
  title,
  className = '',
  size = 'md',
}) {
  const c = normalizeCompetition(competition);
  const score = c?.score;
  const filled = competitionSegments(score);
  const wrapStyle = competitionRoundPillStyle(score);
  const fill = competitionSegmentFillColor(score);
  const label = competitionDisplayLabel(c);
  const isSm = size === 'sm';

  return (
    <span
      className={[
        'inline-flex flex-col items-center justify-center rounded-full border',
        isSm ? 'h-11 w-11 gap-0.5 px-1' : 'h-16 w-16 gap-0.5 px-1.5 py-1',
        className,
      ].join(' ')}
      style={wrapStyle}
      title={title || [label, c?.note].filter(Boolean).join(' — ') || 'Concurrence'}
      aria-label={
        filled == null
          ? 'Concurrence non disponible'
          : `Concurrence ${label} : ${filled} sur ${COMPETITION_SEGMENT_COUNT}`
      }
    >
      <IconCompetition className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span
        className={['flex items-end justify-center', isSm ? 'gap-px h-3.5' : 'gap-0.5 h-5'].join(' ')}
        aria-hidden="true"
      >
        {Array.from({ length: COMPETITION_SEGMENT_COUNT }, (_, i) => {
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
        {filled == null ? 'n/d' : `${filled}/${COMPETITION_SEGMENT_COUNT}`}
      </span>
    </span>
  );
}
