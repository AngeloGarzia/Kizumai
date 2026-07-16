import { AccountingProfileModel } from '../models/AccountingProfileModel.js';
import { CompanyService } from './CompanyService.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { AppError } from '../utils/AppError.js';

export const AccountingProfileService = {
  /**
   * Renvoie le profil comptable de la société liée au projet, en le créant
   * (vide) si besoin. La société doit exister au préalable.
   */
  async ensureForProject(userId, projectId) {
    const company = await CompanyService.getForProject(userId, projectId);
    const existing = await AccountingProfileModel.findByCompanyId(company.id);
    if (existing) return existing;
    return AccountingProfileModel.create({ companyId: company.id });
  },

  async getForProject(userId, projectId) {
    const company = await CompanyService.getForProject(userId, projectId);
    const profile = await AccountingProfileModel.findByCompanyId(company.id);
    if (!profile) throw new AppError('Aucun profil comptable pour cette société', 404);
    return profile;
  },

  async updateForProject(userId, projectId, fields) {
    const profile = await this.ensureForProject(userId, projectId);
    return AccountingProfileModel.update(profile.id, fields);
  },

  async markTransmitted(userId, projectId) {
    const profile = await this.ensureForProject(userId, projectId);
    return AccountingProfileModel.update(profile.id, {
      status: 'transmis',
      transmittedAt: new Date().toISOString(),
    });
  },

  /**
   * Assemble le dossier complet à transmettre à l'expert-comptable
   * PAR JOINTURE des données existantes — aucune duplication en base.
   */
  async buildDossier(userId, projectId) {
    const company = await CompanyService.getFullForProject(userId, projectId);
    const profile =
      (await AccountingProfileModel.findByCompanyId(company.id)) ??
      (await AccountingProfileModel.create({ companyId: company.id }));

    // Les pièces justificatives réelles vivent dans `documents` (clé projet).
    const documents = await DocumentModel.findByProjectId(projectId);

    return {
      generatedAt: new Date().toISOString(),
      status: profile.status,

      // Identité (source : companies)
      societe: {
        denomination: company.denomination,
        nomCommercial: company.tradeName,
        formeJuridique: company.legalFormLabel,
        siren: company.siren,
        siret: company.siretHq,
        tvaIntracom: company.vatNumber,
        codeNaf: company.nafApeCode,
        capital: company.shareCapital,
        devise: company.capitalCurrency,
        pays: company.countryCode,
        dateImmatriculation: company.incorporationDate,
        objetSocial: company.activityDescription,
      },
      activite: company.activity,
      siege: company.location,
      etablissements: company.establishments,

      // Dirigeants & bénéficiaires (source : company_officers)
      dirigeants: company.officers,

      // Choix comptables/fiscaux (source : accounting_profiles)
      comptabilite: {
        regimeFiscal: profile.taxRegime,
        optionIS: profile.isOption,
        regimeTVA: profile.vatRegime,
        periodiciteTVA: profile.vatPeriodicity,
        referentiel: profile.accountingStandard,
        debutExercice: profile.fiscalYearStart,
        finExercice: profile.fiscalYearEnd,
        datePremiereCloture: profile.firstClosingDate,
        regimeSocialDirigeant: profile.directorSocialRegime,
        conventionCollective: profile.collectiveAgreement,
        codeIdcc: profile.idccCode,
        organismesSociaux: profile.socialOrganizations,
        comptesBancaires: profile.bankAccounts,
        logicielFacturation: profile.invoicingSoftware,
        modeTransmission: profile.transmissionMode,
        caPrevisionnel: profile.estimatedAnnualRevenue,
        facturesMensuellesEstimees: profile.estimatedMonthlyInvoices,
        notes: profile.notes,
      },

      // Cabinet destinataire (source : accounting_profiles)
      cabinet: {
        nom: profile.firmName,
        siren: profile.firmSiren,
        contact: profile.firmContact,
        debutMission: profile.missionStartDate,
        lettreMissionSignee: profile.missionLetterSigned,
      },

      // Pièces jointes (source : documents)
      pieces: documents.map((d) => ({
        id: d.id,
        type: d.type,
        titre: d.title,
        fichier: d.fileName,
        taille: d.sizeBytes,
      })),
    };
  },
};
