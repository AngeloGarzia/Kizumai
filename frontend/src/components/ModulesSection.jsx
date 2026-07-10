import { IconBulb, IconChevronRight, IconPin, IconUser } from './icons.jsx';

const modules = [
  { title: 'Bilan de compétences', percent: 80, icon: IconUser },
  { title: 'Idées rentables', percent: 60, icon: IconBulb },
  { title: 'Lieu stratégique', percent: 20, icon: IconPin },
];

function ModuleCard({ module, locked = false, onClick }) {
  const Icon = module.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card flex flex-col items-start p-4 min-w-[140px] sm:min-w-0 w-full text-left
                  transition-transform active:scale-[0.98] hover:shadow-md
                  ${locked ? 'opacity-90' : ''}`}
    >
      <span className="flex items-center justify-center w-11 h-11 rounded-2xl mb-3 bg-prune-100 text-prune-700">
        <Icon className="w-6 h-6" />
      </span>

      <h3 className="text-sm font-semibold text-prune-900 leading-snug mb-4 flex-1">
        {module.title}
      </h3>

      <div className="w-full">
        <div className="h-1.5 bg-prune-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-wasabi-400"
            style={{ width: `${module.percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs font-semibold text-wasabi-700">{module.percent}%</span>
          <span className="flex items-center justify-center w-8 h-8 rounded-full text-white bg-topaz-500 hover:bg-topaz-600">
            <IconChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

export default function ModulesSection({ locked = false, onModuleClick, onViewAll }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-xs sm:text-sm font-bold tracking-widest text-prune-600 uppercase">
          Tes modules
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs sm:text-sm font-semibold text-topaz-600 hover:text-topaz-500 flex items-center gap-0.5"
        >
          Voir tout
          <IconChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:gap-5">
        {modules.map((module) => (
          <ModuleCard
            key={module.title}
            module={module}
            locked={locked}
            onClick={() => onModuleClick(module)}
          />
        ))}
      </div>
    </section>
  );
}
