import CompetitionSegmentsPill from './CompetitionSegmentsPill.jsx';
import ProfitabilitySegmentsPill from './ProfitabilitySegmentsPill.jsx';
import FeasibilityRoundPill from './FeasibilityRoundPill.jsx';
import { buildMetricPillDetail } from '../utils/metricPillDetail.js';
import {
  competitionDisplayLabel,
  normalizeCompetition,
} from '../utils/competitionPill.js';
import {
  normalizeProfitability,
  profitabilityDisplayLabel,
} from '../utils/profitabilityPill.js';

/**
 * Groupe des 3 pastilles. Le parent gère la popup (évite plusieurs overlays).
 */
export default function BusinessMetricPills({
  business,
  size = 'md',
  className = '',
  onOpenDetail,
}) {
  const competition = normalizeCompetition(business);
  const profitability = normalizeProfitability(business);
  const competitionTitle =
    [
      competition?.note,
      competitionDisplayLabel(competition),
      competition?.source === 'web'
        ? 'Estimation avec recherche web'
        : competition?.source === 'estimated'
          ? 'Estimation sans recherche web'
          : null,
      'Cliquez pour le détail',
    ]
      .filter(Boolean)
      .join(' — ') || 'Concurrence — cliquez pour le détail';
  const profitabilityTitle =
    [profitability?.note, profitabilityDisplayLabel(profitability), 'Cliquez pour le détail']
      .filter(Boolean)
      .join(' — ') || 'Rentabilité — cliquez pour le détail';

  const open = (kind, payload) => {
    onOpenDetail?.(buildMetricPillDetail(kind, payload));
  };

  return (
    <div
      className={['shrink-0 flex flex-nowrap items-center justify-end gap-2', className].join(
        ' '
      )}
    >
      <CompetitionSegmentsPill
        competition={competition}
        title={competitionTitle}
        size={size}
        onClick={() =>
          open('competition', {
            score: competition?.score,
            label: competitionDisplayLabel(competition),
            note: competition?.note,
            source: competition?.source,
          })
        }
      />
      <ProfitabilitySegmentsPill
        profitability={profitability}
        title={profitabilityTitle}
        size={size}
        onClick={() =>
          open('profitability', {
            score: profitability?.score,
            label: profitabilityDisplayLabel(profitability),
            note: profitability?.note,
          })
        }
      />
      <FeasibilityRoundPill
        score={business?.feasibility}
        size={size}
        onClick={() =>
          open('feasibility', {
            score: business?.feasibility,
            modes: business?.modes,
          })
        }
      />
    </div>
  );
}
