import { Navigate, useParams } from 'react-router-dom';
import StageWorkspace from '../components/StageWorkspace.jsx';
import { PROJECT_STAGE_IDS } from '../constants/projectStages.js';

const WORKFLOW_STAGES = new Set(
  PROJECT_STAGE_IDS.filter((id) => id !== 'idee')
);

/**
 * Page générique d'étape : /projet/:id/etape/:stage
 * stage = etude_marche | business_plan | financement | immatriculation | lancement
 */
export default function ProjectStage() {
  const { id, stage } = useParams();
  if (!id || !WORKFLOW_STAGES.has(stage)) {
    return <Navigate to="/parcours" replace />;
  }
  return <StageWorkspace projectId={id} stage={stage} />;
}
