import { sanitizeDisplayText } from '../utils/safeDisplay.js';
import { ASSISTANT_NAME, assistantPhrases } from '../constants/assistant.js';
import FabulousThinking from './FabulousThinking.jsx';
import CompetitionSegmentsPill from './CompetitionSegmentsPill.jsx';
import ProfitabilitySegmentsPill from './ProfitabilitySegmentsPill.jsx';
import {
  competitionDisplayLabel,
  normalizeCompetition,
} from '../utils/competitionPill.js';
import {
  normalizeProfitability,
  profitabilityDisplayLabel,
} from '../utils/profitabilityPill.js';

function formatBudget(amount, currency) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function asText(value) {
  return sanitizeDisplayText(value, { max: 50_000 });
}

function parseReportSections(report) {
  const text = asText(report);
  if (!text) return [];
  const blocks = text.split(/^##\s+/m).filter(Boolean);
  return blocks
    .map((block) => {
      const [titleLine, ...rest] = block.split('\n');
      return {
        title: titleLine.trim(),
        content: rest.join('\n').trim(),
      };
    })
    .filter((section) => section.title && section.content);
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((section) => {
      if (!section || typeof section !== 'object') return null;
      const title = asText(section.title).trim();
      const content = asText(section.content).trim();
      if (!title || !content) return null;
      return { title, content };
    })
    .filter(Boolean);
}

function getReportSections(project) {
  const fromSections = normalizeSections(project?.sections);
  if (fromSections.length) return fromSections;
  return parseReportSections(project?.report);
}

function renderSectionContent(content) {
  const text = asText(content);
  if (!text) return null;

  const blocks = text.split(/\n\s*\n/).filter(Boolean);
  const isBulletList = blocks.length === 1 && blocks[0].includes('•');

  if (isBulletList) {
    const items = blocks[0]
      .split('\n')
      .map((line) => line.replace(/^•\s*/, '').trim())
      .filter(Boolean);
    return (
      <ul className="space-y-2 list-none">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm sm:text-base text-prune-800 leading-relaxed">
            <span className="text-topaz-500 font-bold shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return blocks.map((paragraph, index) => (
    <p key={index} className="text-sm sm:text-base text-prune-800 leading-relaxed">
      {paragraph}
    </p>
  ));
}

function CompetitionBlock({ competition, analysis }) {
  const normalized = normalizeCompetition(competition);
  const competitors = Array.isArray(analysis?.competitors)
    ? analysis.competitors
        .map((c) => {
          if (!c || typeof c !== 'object') return null;
          const name = asText(c.name || c.title).trim();
          if (!name) return null;
          const rawUrl = String(c.url || c.website || c.link || '').trim();
          let url = null;
          if (rawUrl && !/^null$/i.test(rawUrl)) {
            try {
              const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
              const u = new URL(withProto);
              if (
                (u.protocol === 'http:' || u.protocol === 'https:') &&
                u.hostname.includes('.')
              ) {
                url = u.toString();
              }
            } catch {
              url = null;
            }
          }
          return {
            name: name.slice(0, 120),
            kind: asText(c.kind || c.type || '').trim().slice(0, 40) || null,
            impact: asText(c.impact || c.effect || '').trim().slice(0, 500) || null,
            url,
          };
        })
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const impactSummary = asText(analysis?.competitionImpact || '').trim();

  if (!normalized && !competitors.length && !impactSummary) return null;

  const titleBits = [
    normalized?.note,
    competitionDisplayLabel(normalized),
    normalized?.source === 'web'
      ? 'estimation web'
      : normalized?.source === 'estimated'
        ? 'estimation'
        : null,
  ].filter(Boolean);

  const linkHost = (href) => {
    try {
      return new URL(href).hostname.replace(/^www\./, '');
    } catch {
      return href;
    }
  };

  return (
    <section className="px-5 sm:px-8 py-5 sm:py-6 border-b border-prune-100">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-prune-500 uppercase">
            Concurrence
          </p>
          <p className="mt-1 text-xs text-prune-400">
            Acteurs repérés et impact sur votre projet
          </p>
        </div>
        {normalized && (
          <CompetitionSegmentsPill
            competition={normalized}
            title={titleBits.join(' — ')}
          />
        )}
      </div>

      {normalized?.note && (
        <p className="text-sm text-prune-700 leading-relaxed mb-4">{asText(normalized.note)}</p>
      )}

      {impactSummary && (
        <p className="text-sm sm:text-base text-prune-800 leading-relaxed mb-4">
          {impactSummary}
        </p>
      )}

      {competitors.length > 0 && (
        <ul className="space-y-3">
          {competitors.map((c, index) => (
            <li
              key={`${c.name}-${index}`}
              className="rounded-xl border border-prune-100 bg-white/70 px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-prune-900">{c.name}</span>
                {c.kind && (
                  <span className="text-xs font-medium uppercase tracking-wide text-prune-400">
                    {c.kind}
                  </span>
                )}
              </div>
              {c.impact && (
                <p className="mt-1.5 text-sm text-prune-700 leading-relaxed">{c.impact}</p>
              )}
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-topaz-700 hover:text-topaz-900 underline-offset-2 hover:underline break-all"
                >
                  {linkHost(c.url)}
                  <span aria-hidden="true" className="text-xs">
                    ↗
                  </span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfitabilityBlock({ profitability }) {
  const normalized = normalizeProfitability(profitability);
  if (!normalized) return null;

  return (
    <section className="px-5 sm:px-8 py-5 sm:py-6 border-b border-prune-100">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-prune-500 uppercase">
            Rentabilité
          </p>
          <p className="mt-1 text-xs text-prune-400">
            Probable rentabilité réelle et sérieuse du business
          </p>
        </div>
        <ProfitabilitySegmentsPill
          profitability={normalized}
          title={[normalized.note, profitabilityDisplayLabel(normalized)]
            .filter(Boolean)
            .join(' — ')}
        />
      </div>
      {normalized.note && (
        <p className="text-sm text-prune-700 leading-relaxed">{asText(normalized.note)}</p>
      )}
      <p className="mt-2 text-xs text-prune-400 leading-relaxed">
        Un budget trop élevé pour le besoin du projet n’améliore pas ce score : il mesure le
        retour crédible, pas le confort de trésorerie.
      </p>
    </section>
  );
}

function FabulousAnalysisBlock({ analysis, loading, error }) {
  if (loading) {
    return (
      <section className="px-5 sm:px-8 py-5 sm:py-6 border-b border-prune-100 bg-white/60">
        <p className="text-xs font-semibold tracking-widest text-prune-500 uppercase mb-3">
          Analyse {ASSISTANT_NAME}
        </p>
        <FabulousThinking message={assistantPhrases.thinking} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-5 sm:px-8 py-5 sm:py-6 border-b border-prune-100">
        <p className="text-xs font-semibold tracking-widest text-prune-500 uppercase mb-2">
          Analyse {ASSISTANT_NAME}
        </p>
        <p className="text-sm text-amber-800">{error}</p>
      </section>
    );
  }

  if (!analysis?.summary && !analysis?.outlook) return null;

  return (
    <section className="px-5 sm:px-8 py-5 sm:py-6 border-b border-prune-100 bg-gradient-to-br from-prune-50/80 to-white">
      <p className="text-xs font-semibold tracking-widest text-prune-500 uppercase">
        Analyse {ASSISTANT_NAME}
      </p>
      <p className="mt-1 text-xs text-prune-400">
        Lecture neutre et objective — sans promesse de réussite.
      </p>

      {analysis.summary && (
        <p className="mt-4 text-sm sm:text-base text-prune-800 leading-relaxed">
          {asText(analysis.summary)}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && (
          <div className="rounded-xl border border-wasabi-100 bg-wasabi-50/50 p-4">
            <h4 className="text-sm font-semibold text-prune-900 mb-2">Points favorables</h4>
            <ul className="space-y-2">
              {analysis.strengths.map((item, index) => (
                <li key={index} className="flex gap-2 text-sm text-prune-800 leading-relaxed">
                  <span className="text-wasabi-600 font-bold shrink-0">+</span>
                  <span>{asText(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(analysis.risks) && analysis.risks.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
            <h4 className="text-sm font-semibold text-prune-900 mb-2">Points de vigilance</h4>
            <ul className="space-y-2">
              {analysis.risks.map((item, index) => (
                <li key={index} className="flex gap-2 text-sm text-prune-800 leading-relaxed">
                  <span className="text-amber-700 font-bold shrink-0">!</span>
                  <span>{asText(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {analysis.outlook && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-prune-900 mb-2">Perspectives</h4>
          <p className="text-sm sm:text-base text-prune-800 leading-relaxed">
            {asText(analysis.outlook)}
          </p>
        </div>
      )}
    </section>
  );
}

export default function ProjectReport({
  project,
  fabulousAnalysis = null,
  analysisLoading = false,
  analysisError = '',
}) {
  if (!project) return null;

  const sections = getReportSections(project);
  const reportText = asText(project.report);
  const plainParagraphs = reportText
    ? reportText.split(/\n\s*\n/).filter(Boolean)
    : [];
  const locationLabel = project.ou || project.location?.label || '—';
  const activityLabel = project.quoi || project.activity?.label || project.title || '—';
  const training = project.training || project.metadata?.training;
  const analysis = fabulousAnalysis || project.fabulousAnalysis || null;
  const competition = project.metadata?.competition || project.competition || null;
  const profitability = project.metadata?.profitability || project.profitability || null;
  const locationMode =
    project.locationMode ||
    project.metadata?.locationMode ||
    'fixed';
  const locationFieldLabel =
    locationMode === 'nomadic'
      ? 'Mobilité'
      : locationMode === 'dematerialized'
        ? 'Setup digital'
        : 'Lieu';

  return (
    <article className="rounded-2xl border border-prune-100 bg-gradient-to-b from-white to-prune-50/40 overflow-hidden">
      <header className="px-5 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-prune-100">
        <p className="text-xs font-semibold tracking-widest text-prune-500 uppercase">
          Informations générales
        </p>
        <h2 className="mt-2 text-xl sm:text-2xl font-bold text-prune-900 leading-snug">
          {activityLabel}
        </h2>
        {project.description && (
          <p className="mt-2 text-sm text-prune-600 leading-relaxed">
            {asText(project.description)}
          </p>
        )}
      </header>

      <FabulousAnalysisBlock
        analysis={analysis}
        loading={analysisLoading}
        error={analysisError}
      />

      <CompetitionBlock competition={competition} analysis={analysis} />

      <ProfitabilityBlock profitability={profitability} />
      {sections.length > 0 ? (
        <div className="divide-y divide-prune-100">
          {sections.map((section, index) => (
            <section key={index} className="px-5 sm:px-8 py-5 sm:py-6">
              <h3 className="text-base sm:text-lg font-semibold text-prune-900 mb-3 sm:mb-4">
                {section.title}
              </h3>
              <div className="space-y-4">{renderSectionContent(section.content)}</div>
            </section>
          ))}
        </div>
      ) : plainParagraphs.length > 0 ? (
        <div className="px-5 sm:px-8 py-6 sm:py-8 space-y-5">
          {plainParagraphs.map((paragraph, index) => (
            <p
              key={index}
              className="text-sm sm:text-base text-prune-800 leading-relaxed whitespace-pre-line"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : (
        <div className="px-5 sm:px-8 py-6 sm:py-8 space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-prune-500">
                Activité
              </dt>
              <dd className="mt-1 text-sm font-medium text-prune-900">
                {project.activity?.label || project.quoi || '—'}
              </dd>
              {project.activity?.sector && (
                <dd className="text-sm text-prune-500">{project.activity.sector}</dd>
              )}
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-prune-500">
                Forme juridique
              </dt>
              <dd className="mt-1 text-sm font-medium text-prune-900">
                {project.legalForm || '—'}
              </dd>
            </div>
          </dl>
          {!project.description && !analysis && !analysisLoading && (
            <p className="text-sm text-prune-500 italic">
              Aucun détail de recherche n&apos;est disponible pour ce projet.
            </p>
          )}
        </div>
      )}

      <footer className="px-5 sm:px-8 py-4 sm:py-5 bg-prune-50/80 border-t border-prune-100">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-prune-500">{locationFieldLabel}</dt>
            <dd className="mt-1 text-sm font-medium text-prune-900">{locationLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-prune-500">
              Budget estimé
            </dt>
            <dd className="mt-1 text-sm font-medium text-wasabi-700">
              {formatBudget(project.budget, project.currency)}
            </dd>
          </div>
          {training?.title && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-prune-500">
                Formation mise de côté
              </dt>
              <dd className="mt-1 text-sm font-medium text-prune-900">
                {training.title}
                {training.level ? ` · ${training.level}` : ''}
                {training.duration ? ` · ${training.duration}` : ''}
              </dd>
            </div>
          )}
        </dl>
      </footer>
    </article>
  );
}
