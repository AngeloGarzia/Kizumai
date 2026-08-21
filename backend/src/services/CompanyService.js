import { AppError } from '../utils/AppError.js';

export function createCompanyService({
  companyRepository,
  companyEstablishmentRepository,
  companyOfficerRepository,
  companyFinancialRepository,
  projectRepository,
  projectMemoryUpdateService = null,
}) {
  async function getUserProject(userId, projectId) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) {
      throw new AppError('Projet introuvable', 404);
    }
    return project;
  }

  return {
    /**
     * Crée la fiche société d'un projet, ou renvoie celle qui existe déjà.
     *
     * On NE réutilise que les informations réellement présentes sur le projet
     * (dénomination provisoire = titre, forme juridique, activité, lieu du siège).
     * Tous les identifiants légaux (SIREN, RCS, TVA…) restent vides : ils se
     * garniront au fur et à mesure de l'avancement et des autorisations obtenues.
     */
    async ensureForProject(userId, projectId) {
      const project = await getUserProject(userId, projectId);

      const existing = await companyRepository.findByProjectId(projectId);
      if (existing) return existing;

      return companyRepository.create({
        projectId: project.id,
        activityId: project.activityId ?? null,
        locationId: project.locationId ?? null,
        denomination: project.title ?? null,
        legalFormLabel: project.legalForm ?? null,
        countryCode: project.location?.country ?? 'FR',
        lifecycleState: 'projet',
        source: 'project',
      });
    },

    async getForProject(userId, projectId) {
      await getUserProject(userId, projectId);
      const company = await companyRepository.findByProjectId(projectId);
      if (!company) throw new AppError('Aucune société liée à ce projet', 404);
      return company;
    },

    async getFullForProject(userId, projectId) {
      const company = await this.getForProject(userId, projectId);
      const [establishments, officers, financials] = await Promise.all([
        companyEstablishmentRepository.findByCompanyId(company.id),
        companyOfficerRepository.findByCompanyId(company.id),
        companyFinancialRepository.findByCompanyId(company.id),
      ]);
      return { ...company, establishments, officers, financials };
    },

    async updateForProject(userId, projectId, fields) {
      const company = await this.getForProject(userId, projectId);
      const before = company.lifecycleState;
      const updated = await companyRepository.update(company.id, fields);

      if (
        projectMemoryUpdateService &&
        fields.lifecycleState != null &&
        fields.lifecycleState !== before
      ) {
        projectMemoryUpdateService.recordEventSafe({
          projectId,
          nodeType: 'event',
          content: `Cycle de vie société : ${before} → ${fields.lifecycleState}`,
          sourceEntityType: 'company',
          sourceEntityId: company.id,
          importance: 0.8,
        });
      }

      return updated;
    },
  };
}
