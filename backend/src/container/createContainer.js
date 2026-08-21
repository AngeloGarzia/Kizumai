/**
 * Composition root — seul endroit qui couple les implémentations concrètes.
 * Les controllers / services ne s'importent pas entre couches concrètes :
 * ils reçoivent leurs dépendances via factories.
 */

import { UserRepository } from '../repositories/UserRepository.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { LocationRepository } from '../repositories/LocationRepository.js';
import { DocumentRepository } from '../repositories/DocumentRepository.js';
import { ResourceCategoryRepository } from '../repositories/ResourceCategoryRepository.js';
import { LearningRecordRepository } from '../repositories/LearningRecordRepository.js';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository.js';
import { PlannerEventRepository } from '../repositories/PlannerEventRepository.js';
import { ContactRepository } from '../repositories/ContactRepository.js';
import { ContactLinkRepository } from '../repositories/ContactLinkRepository.js';
import { CompanyRepository } from '../repositories/CompanyRepository.js';
import { CompanyEstablishmentRepository } from '../repositories/CompanyEstablishmentRepository.js';
import { CompanyOfficerRepository } from '../repositories/CompanyOfficerRepository.js';
import { CompanyFinancialRepository } from '../repositories/CompanyFinancialRepository.js';
import { AccountingProfileRepository } from '../repositories/AccountingProfileRepository.js';
import { SettingsRepository } from '../repositories/SettingsRepository.js';
import { AiPromptRepository } from '../repositories/AiPromptRepository.js';
import { ConnectionRepository } from '../repositories/ConnectionRepository.js';
import { PushSubscriptionRepository } from '../repositories/PushSubscriptionRepository.js';

import { TokenService } from '../services/TokenService.js';
import { createCurrencyService } from '../services/CurrencyService.js';
import { StorageService } from '../services/StorageService.js';
import { createSettingsService } from '../services/SettingsService.js';
import { createConnectionService } from '../services/ConnectionService.js';
import { createUserService } from '../services/UserService.js';
import { createAuthService } from '../services/AuthService.js';
import { createAiService } from '../services/AiService.js';
import { createProjectService } from '../services/ProjectService.js';
import { createDocumentService } from '../services/DocumentService.js';
import { createLearningRecordService } from '../services/LearningRecordService.js';
import { createPlannerService } from '../services/PlannerService.js';
import { createPushService } from '../services/PushService.js';
import { createNotificationService } from '../services/NotificationService.js';
import { createAdminService } from '../services/AdminService.js';
import { createContactService } from '../services/ContactService.js';
import { createCompanyService } from '../services/CompanyService.js';
import { createAccountingProfileService } from '../services/AccountingProfileService.js';

import { createAuthenticate, createOptionalAuth } from '../middleware/auth.js';
import { createAuthController } from '../controllers/AuthController.js';
import { createUserController } from '../controllers/UserController.js';
import { createProjectController } from '../controllers/ProjectController.js';
import { createDocumentController } from '../controllers/DocumentController.js';
import { createLearningRecordController } from '../controllers/LearningRecordController.js';
import { createPlannerController } from '../controllers/PlannerController.js';
import { createAdminController } from '../controllers/AdminController.js';
import { createNotificationController } from '../controllers/NotificationController.js';
import { createCurrencyController } from '../controllers/CurrencyController.js';
import { ProjectStageRepository } from '../repositories/ProjectStageRepository.js';
import { createProjectStageService } from '../services/ProjectStageService.js';
import { createProjectStageController } from '../controllers/ProjectStageController.js';
import { DocumentScanRepository } from '../repositories/DocumentScanRepository.js';
import { createDocumentScanService } from '../services/DocumentScanService.js';
import { createDocumentScanController } from '../controllers/DocumentScanController.js';
import { ProjectMemoryNodeRepository } from '../repositories/ProjectMemoryNodeRepository.js';
import { ProjectMemoryEdgeRepository } from '../repositories/ProjectMemoryEdgeRepository.js';
import { ProjectMemorySnapshotRepository } from '../repositories/ProjectMemorySnapshotRepository.js';
import { createProjectMemoryUpdateService } from '../services/ProjectMemoryUpdateService.js';
import { createProjectMemoryDecayJob } from '../services/ProjectMemoryDecayJob.js';
import { createProjectMemorySnapshotService } from '../services/ProjectMemorySnapshotService.js';
import { createProjectMemoryRecallService } from '../services/ProjectMemoryRecallService.js';
import { createProjectMemoryScanService } from '../services/ProjectMemoryScanService.js';
import { createProjectTimelineService } from '../services/ProjectTimelineService.js';

export function createContainer() {
  // ── Infrastructure (repositories) ─────────────────────────────
  const userRepository = UserRepository;
  const projectRepository = ProjectRepository;
  const activityRepository = ActivityRepository;
  const locationRepository = LocationRepository;
  const documentRepository = DocumentRepository;
  const resourceCategoryRepository = ResourceCategoryRepository;
  const documentScanRepository = DocumentScanRepository;
  const learningRecordRepository = LearningRecordRepository;
  const refreshTokenRepository = RefreshTokenRepository;
  const plannerEventRepository = PlannerEventRepository;
  const contactRepository = ContactRepository;
  const contactLinkRepository = ContactLinkRepository;
  const companyRepository = CompanyRepository;
  const companyEstablishmentRepository = CompanyEstablishmentRepository;
  const companyOfficerRepository = CompanyOfficerRepository;
  const companyFinancialRepository = CompanyFinancialRepository;
  const accountingProfileRepository = AccountingProfileRepository;
  const settingsRepository = SettingsRepository;
  const aiPromptRepository = AiPromptRepository;
  const connectionRepository = ConnectionRepository;
  const pushSubscriptionRepository = PushSubscriptionRepository;
  const projectStageRepository = ProjectStageRepository;
  const projectMemoryNodeRepository = ProjectMemoryNodeRepository;
  const projectMemoryEdgeRepository = ProjectMemoryEdgeRepository;
  const projectMemorySnapshotRepository = ProjectMemorySnapshotRepository;

  const tokenService = TokenService;
  const storageService = StorageService;

  // ── Domain services (dépendances injectées) ───────────────────
  const settingsService = createSettingsService({
    settingsRepository,
    aiPromptRepository,
  });

  const currencyService = createCurrencyService({ settingsService });

  const connectionService = createConnectionService({
    connectionRepository,
  });

  const userService = createUserService({
    userRepository,
  });

  const authService = createAuthService({
    userRepository,
    refreshTokenRepository,
    tokenService,
    settingsService,
  });

  const aiService = createAiService({
    settingsService,
    currencyService,
  });

  const projectMemoryDecayJob = createProjectMemoryDecayJob({
    projectMemoryNodeRepository,
    settingsService,
  });

  const projectMemorySnapshotService = createProjectMemorySnapshotService({
    projectMemoryNodeRepository,
    projectMemorySnapshotRepository,
    aiService,
    settingsService,
  });

  const projectMemoryUpdateService = createProjectMemoryUpdateService({
    projectMemoryNodeRepository,
    projectMemoryEdgeRepository,
    projectMemorySnapshotRepository,
    aiService,
    projectMemorySnapshotService,
    settingsService,
  });

  const projectMemoryRecallService = createProjectMemoryRecallService({
    projectMemoryNodeRepository,
    projectMemoryEdgeRepository,
    projectMemorySnapshotRepository,
    aiService,
    settingsService,
  });

  const projectMemoryScanService = createProjectMemoryScanService({
    projectRepository,
    documentRepository,
    documentScanRepository,
    contactRepository,
    companyRepository,
    companyOfficerRepository,
    companyEstablishmentRepository,
    companyFinancialRepository,
    accountingProfileRepository,
    plannerEventRepository,
    learningRecordRepository,
    projectStageRepository,
    projectMemoryNodeRepository,
    projectMemoryEdgeRepository,
    projectMemorySnapshotService,
    aiService,
  });

  const projectTimelineService = createProjectTimelineService({
    projectRepository,
    documentRepository,
    documentScanRepository,
    contactRepository,
    companyRepository,
    plannerEventRepository,
    learningRecordRepository,
    projectStageRepository,
    projectMemoryNodeRepository,
    projectMemorySnapshotRepository,
  });

  const projectService = createProjectService({
    projectRepository,
    activityRepository,
    locationRepository,
    aiService,
    currencyService,
    projectMemoryUpdateService,
    projectMemoryRecallService,
    projectMemoryScanService,
    projectTimelineService,
    projectStageRepository,
  });

  const documentScanService = createDocumentScanService({
    documentScanRepository,
    documentRepository,
    projectRepository,
    contactRepository,
    contactLinkRepository,
    plannerEventRepository,
    locationRepository,
    storageService,
    aiService,
    projectMemoryUpdateService,
    projectMemoryRecallService,
  });

  const documentService = createDocumentService({
    documentRepository,
    projectService,
    storageService,
    resourceCategoryRepository,
    contactLinkRepository,
    contactRepository,
    documentScanService,
    projectMemoryUpdateService,
  });

  const projectStageService = createProjectStageService({
    projectStageRepository,
    projectRepository,
    documentRepository,
    contactRepository,
    plannerEventRepository,
    projectMemoryUpdateService,
  });

  const learningRecordService = createLearningRecordService({
    learningRecordRepository,
    projectRepository,
    documentRepository,
    projectMemoryUpdateService,
  });

  const plannerService = createPlannerService({
    plannerEventRepository,
    projectRepository,
    projectMemoryUpdateService,
  });

  const pushService = createPushService({
    pushSubscriptionRepository,
  });

  const notificationService = createNotificationService({
    userRepository,
    pushSubscriptionRepository,
    pushService,
  });

  const adminService = createAdminService({
    settingsRepository,
    aiPromptRepository,
    userRepository,
    connectionService,
  });

  const contactService = createContactService({
    contactRepository,
    contactLinkRepository,
    projectRepository,
    documentRepository,
    plannerEventRepository,
    companyRepository,
    projectMemoryUpdateService,
  });

  const companyService = createCompanyService({
    companyRepository,
    companyEstablishmentRepository,
    companyOfficerRepository,
    companyFinancialRepository,
    projectRepository,
    projectMemoryUpdateService,
  });

  const accountingProfileService = createAccountingProfileService({
    accountingProfileRepository,
    documentRepository,
    companyService,
  });

  // ── HTTP adapters ─────────────────────────────────────────────
  const authenticate = createAuthenticate({ authService });
  const optionalAuth = createOptionalAuth({ authService });

  const authController = createAuthController({ authService, connectionService });
  const userController = createUserController({ userService });
  const projectController = createProjectController({ projectService });
  const documentController = createDocumentController({
    documentService,
    storageService,
  });
  const documentScanController = createDocumentScanController({
    documentScanService,
  });
  const projectStageController = createProjectStageController({
    projectStageService,
  });
  const learningRecordController = createLearningRecordController({
    learningRecordService,
  });
  const plannerController = createPlannerController({ plannerService });
  const adminController = createAdminController({
    adminService,
    notificationService,
  });
  const notificationController = createNotificationController({ pushService });
  const currencyController = createCurrencyController({ currencyService });

  return {
    // ports utiles aux tests / scripts
    repositories: {
      userRepository,
      projectRepository,
      refreshTokenRepository,
    },
    services: {
      userService,
      authService,
      projectService,
      documentService,
      documentScanService,
      projectStageService,
      learningRecordService,
      plannerService,
      adminService,
      notificationService,
      pushService,
      settingsService,
      connectionService,
      contactService,
      companyService,
      accountingProfileService,
      aiService,
      currencyService,
      storageService,
      tokenService,
      projectMemoryUpdateService,
      projectMemoryDecayJob,
      projectMemorySnapshotService,
      projectMemoryRecallService,
      projectMemoryScanService,
    },
    middleware: {
      authenticate,
      optionalAuth,
    },
    controllers: {
      authController,
      userController,
      projectController,
      documentController,
      documentScanController,
      projectStageController,
      learningRecordController,
      plannerController,
      adminController,
      notificationController,
      currencyController,
    },
  };
}
