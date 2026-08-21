import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import BottomNav from '../components/BottomNav.jsx';
import ProgressCard from '../components/ProgressCard.jsx';
import ModulesSection from '../components/ModulesSection.jsx';
import { IconRocket, IconBulb, IconPin, IconUser } from '../components/icons.jsx';
import { stageHref } from '../constants/projectStages.js';
import { competencesPercent, learningService } from '../services/learningService.js';
import { geoPercent } from '../utils/moduleProgress.js';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, isPaid, loading } = useAuth();
  const { currentProject: project, hasProject } = useProject();
  const [learningRecords, setLearningRecords] = useState([]);

  const goToCreateFuture = () => navigate('/creer-son-avenir');

  const showProgressOverlay = !loading && (!isAuthenticated || !isPaid || (isPaid && !hasProject));

  useEffect(() => {
    if (!isAuthenticated || !isPaid) {
      setLearningRecords([]);
      return undefined;
    }
    let active = true;
    learningService
      .list()
      .then((records) => {
        if (!active) return;
        const all = Array.isArray(records) ? records : [];
        setLearningRecords(
          project?.id
            ? all.filter((r) => r.projectId == null || r.projectId === project.id)
            : all
        );
      })
      .catch(() => {
        if (active) setLearningRecords([]);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, isPaid, project?.id]);

  const modules = useMemo(
    () => [
      {
        id: 'parcours',
        title: 'Parcours',
        subtitle: project?.progress?.currentLabel || 'Étapes du projet',
        percent: project?.progress?.percent ?? 0,
        icon: IconBulb,
        path: '/parcours',
      },
      {
        id: 'fil-du-temps',
        title: 'Fil du temps',
        subtitle: 'Journal, documents & mémoire IA',
        percent: project?.progress?.percent ?? 0,
        icon: IconRocket,
        path: '/fil-du-temps',
      },
      {
        id: 'competences',
        title: 'Mes compétences',
        subtitle: learningRecords.length
          ? `${learningRecords.length} entrée(s)`
          : 'Formations & diplômes',
        percent: competencesPercent(learningRecords),
        icon: IconUser,
        path: '/competences',
      },
      {
        id: 'geographie',
        title: 'Lieu du projet',
        subtitle: project?.ou || project?.location?.city || 'Géographie',
        percent: geoPercent(project),
        icon: IconPin,
        path: '/geographie',
      },
    ],
    [learningRecords, project]
  );

  const openModule = (module) => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: module.path || '/' } });
      return;
    }
    if (!isPaid) {
      navigate('/projet/apercu');
      return;
    }
    navigate(module.path || '/');
  };

  const openNextStage = () => {
    if (!project?.id) {
      goToCreateFuture();
      return;
    }
    const stageId = project.progress?.nextStage || project.stage || 'idee';
    navigate(stageHref(stageId, project.id));
  };

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <BottomNav />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-8">
        <main className="page-container flex-1 space-y-6 sm:space-y-8 lg:space-y-10 max-w-[50.4rem] lg:max-w-[67.2rem]">
          <section className="flex justify-center pt-4 sm:pt-8 lg:pt-10">
            <BrandLogo size="hero" asLink={false} className="mx-auto" />
          </section>

          <ProgressCard
            showOverlay={showProgressOverlay}
            onCreateFuture={hasProject ? openNextStage : goToCreateFuture}
            project={project}
            onOpenNext={hasProject ? openNextStage : undefined}
          />

          <ModulesSection
            locked={!isAuthenticated || !isPaid}
            modules={modules}
            onModuleClick={openModule}
            onViewAll={() =>
              navigate(isPaid ? '/parcours' : isAuthenticated ? '/projet/apercu' : '/register')
            }
          />
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
