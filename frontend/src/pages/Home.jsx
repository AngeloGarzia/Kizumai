import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import BottomNav from '../components/BottomNav.jsx';
import ProgressCard from '../components/ProgressCard.jsx';
import ModulesSection from '../components/ModulesSection.jsx';
import NextStepGuide from '../components/NextStepGuide.jsx';
import { IconRocket, IconBulb, IconPin, IconUser } from '../components/icons.jsx';
import { stageHref } from '../constants/projectStages.js';
import { competencesPercent, learningService } from '../services/learningService.js';
import { projectService } from '../services/projectService.js';
import { geoPercent } from '../utils/moduleProgress.js';
import {
  guideFromAdvancementCoach,
  isNextStepGuideSeen,
  markNextStepGuideSeen,
  railStageId,
  readAdvancementCache,
  resolveNextStepGuide,
  writeAdvancementCache,
} from '../utils/nextStepGuide.js';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isPaid, loading } = useAuth();
  const { currentProject: project, hasProject } = useProject();
  const [learningRecords, setLearningRecords] = useState([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeGuide, setActiveGuide] = useState(null);
  const welcomeLockRef = useRef(false);

  const goToCreateFuture = () => navigate('/creer-son-avenir');

  const showProgressOverlay =
    !isAuthenticated || (!loading && (!isPaid || !hasProject));

  const projectId = project?.id ?? null;
  const stageId = project ? railStageId(project) : null;
  const forceWelcome = Boolean(location.state?.showNextStepGuide);

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
          projectId
            ? all.filter((r) => r.projectId == null || r.projectId === projectId)
            : all
        );
      })
      .catch(() => {
        if (active) setLearningRecords([]);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, isPaid, projectId]);

  // Coach d’avancement (IA + mémoire) — fallback texte statique.
  useEffect(() => {
    if (!isPaid || !projectId || !user?.id || !project) {
      setGuideOpen(false);
      setActiveGuide(null);
      welcomeLockRef.current = false;
      return undefined;
    }

    if (forceWelcome) {
      welcomeLockRef.current = true;
      const welcome = resolveNextStepGuide(project, { forceWelcome: true });
      setActiveGuide(welcome);
      setGuideOpen(Boolean(welcome));
      navigate(location.pathname, { replace: true, state: {} });
      return undefined;
    }

    if (welcomeLockRef.current) {
      return undefined;
    }

    const tipKey = `stage:${stageId}`;
    if (isNextStepGuideSeen(user.id, projectId, tipKey)) {
      setGuideOpen(false);
      setActiveGuide(null);
      return undefined;
    }

    let cancelled = false;

    const showStatic = () => {
      if (cancelled || welcomeLockRef.current) return;
      const guide = resolveNextStepGuide(project);
      if (!guide || isNextStepGuideSeen(user.id, projectId, guide.key)) {
        setGuideOpen(false);
        setActiveGuide(null);
        return;
      }
      setActiveGuide(guide);
      setGuideOpen(true);
    };

    const cached = readAdvancementCache(user.id, projectId, stageId);
    if (cached) {
      const guide = guideFromAdvancementCoach(project, cached);
      if (guide && !isNextStepGuideSeen(user.id, projectId, tipKey)) {
        setActiveGuide(guide);
        setGuideOpen(true);
        return undefined;
      }
    }

    showStatic();

    projectService
      .getAdvancementCoach(projectId)
      .then((coach) => {
        if (cancelled || welcomeLockRef.current || !coach) return;
        writeAdvancementCache(user.id, projectId, stageId, coach);
        if (isNextStepGuideSeen(user.id, projectId, tipKey)) return;
        const guide = guideFromAdvancementCoach(project, coach);
        if (!guide) return;
        setActiveGuide(guide);
        setGuideOpen(true);
      })
      .catch(() => {
        // Fallback déjà affiché.
      });

    return () => {
      cancelled = true;
    };
  }, [
    isPaid,
    project,
    projectId,
    stageId,
    user?.id,
    forceWelcome,
    location.pathname,
    navigate,
  ]);

  const dismissGuide = () => {
    const wasWelcome = activeGuide?.key === 'welcome';
    if (user?.id && projectId && activeGuide?.key) {
      markNextStepGuideSeen(user.id, projectId, activeGuide.key);
    }
    welcomeLockRef.current = false;
    setGuideOpen(false);

    if (!wasWelcome || !project || !user?.id) return;

    const nextStage = railStageId(project);
    const tipKey = `stage:${nextStage}`;
    if (isNextStepGuideSeen(user.id, projectId, tipKey)) return;

    const cached = readAdvancementCache(user.id, projectId, nextStage);
    if (cached) {
      const guide = guideFromAdvancementCoach(project, cached);
      if (guide) {
        setActiveGuide(guide);
        setGuideOpen(true);
        return;
      }
    }

    projectService
      .getAdvancementCoach(projectId)
      .then((coach) => {
        if (!coach) return;
        writeAdvancementCache(user.id, projectId, nextStage, coach);
        const guide = guideFromAdvancementCoach(project, coach);
        if (guide) {
          setActiveGuide(guide);
          setGuideOpen(true);
        }
      })
      .catch(() => {
        const guide = resolveNextStepGuide(project);
        if (guide && !isNextStepGuideSeen(user.id, projectId, guide.key)) {
          setActiveGuide(guide);
          setGuideOpen(true);
        }
      });
  };

  const continueGuide = () => {
    const href = activeGuide?.href;
    dismissGuide();
    if (href) navigate(href);
  };

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
        subtitle: 'Journal, documents & mémoire Fabulous',
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
    const next = project.progress?.nextStage || project.stage || 'idee';
    navigate(stageHref(next, project.id));
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
            onCreateFuture={
              !isAuthenticated || !hasProject ? goToCreateFuture : openNextStage
            }
            project={isAuthenticated ? project : null}
            onOpenNext={isAuthenticated && hasProject ? openNextStage : undefined}
            onOpenStage={
              isAuthenticated && hasProject
                ? (stageId) => {
                    if (!project?.id) return;
                    navigate(stageHref(stageId, project.id));
                  }
                : undefined
            }
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

      <NextStepGuide
        open={guideOpen}
        guide={activeGuide}
        onDismiss={dismissGuide}
        onContinue={continueGuide}
      />
    </div>
  );
}
