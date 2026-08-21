import { sanitizeDisplayText } from '../utils/safeDisplay.js';

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

export default function ProjectReport({ project }) {
  if (!project) return null;

  const sections = getReportSections(project);
  const reportText = asText(project.report);
  const plainParagraphs = reportText
    ? reportText.split(/\n\s*\n/).filter(Boolean)
    : [];
  const locationLabel = project.ou || project.location?.label || '—';
  const activityLabel = project.quoi || project.activity?.label || project.title || '—';
  const training = project.training || project.metadata?.training;

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
          {!project.description && (
            <p className="text-sm text-prune-500 italic">
              Aucun détail de recherche n&apos;est disponible pour ce projet.
            </p>
          )}
        </div>
      )}

      <footer className="px-5 sm:px-8 py-4 sm:py-5 bg-prune-50/80 border-t border-prune-100">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-prune-500">Lieu</dt>
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
