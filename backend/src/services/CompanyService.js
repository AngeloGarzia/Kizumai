import { CompanyModel } from '../models/CompanyModel.js';
import { CompanyEstablishmentModel } from '../models/CompanyEstablishmentModel.js';
import { CompanyOfficerModel } from '../models/CompanyOfficerModel.js';
import { CompanyFinancialModel } from '../models/CompanyFinancialModel.js';
import { ProjectService } from './ProjectService.js';
import { AppError } from '../utils/AppError.js';

export const CompanyService = {
  /**
   * Crée la fiche société d'un projet, ou renvoie celle qui existe déjà.
   *
   * On NE réutilise que les informations réellement présentes sur le projet
   * (dénomination provisoire = titre, forme juridique, activité, lieu du siège).
   * Tous les identifiants légaux (SIREN, RCS, TVA…) restent vides : ils se
   * garniront au fur et à mesure de l'avancement et des autorisations obtenues.
   */
  async ensureForProject(userId, projectId) {
    const project = await ProjectService.getUserProject(userId, projectId);

    const existing = await CompanyModel.findByProjectId(projectId);
    if (existing) return existing;

    return CompanyModel.create({
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
    await ProjectService.getUserProject(userId, projectId);
    const company = await CompanyModel.findByProjectId(projectId);
    if (!company) throw new AppError('Aucune société liée à ce projet', 404);
    return company;
  },

  async getFullForProject(userId, projectId) {
    const company = await this.getForProject(userId, projectId);
    const [establishments, officers, financials] = await Promise.all([
      CompanyEstablishmentModel.findByCompanyId(company.id),
      CompanyOfficerModel.findByCompanyId(company.id),
      CompanyFinancialModel.findByCompanyId(company.id),
    ]);
    return { ...company, establishments, officers, financials };
  },

  async updateForProject(userId, projectId, fields) {
    const company = await this.getForProject(userId, projectId);
    return CompanyModel.update(company.id, fields);
  },
};
