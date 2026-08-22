import { optionalNumber, optionalString, parseId, pick } from './helpers.js';
import { PROJECT_STAGE_IDS } from '../constants/projectStages.js';
import { AppError } from '../utils/AppError.js';

const PROJECT_STATUSES = new Set(['draft', 'active', 'paused', 'launched', 'archived']);
const PROJECT_STAGES = new Set(PROJECT_STAGE_IDS);

function normalizeBudgetCurrency(body = {}) {
  return {
    budget: optionalNumber(body.budget),
    currency: optionalString(body.currency) || 'EUR',
  };
}

function optionalProjectId(body = {}) {
  const raw = body.projectId ?? body.project_id;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const ProjectPreviewRequestDto = {
  from(body = {}) {
    return {
      quoi: optionalString(body.quoi, { max: 500 }),
      ou: optionalString(body.ou, { max: 300 }),
      ...normalizeBudgetCurrency(body),
      projectId: optionalProjectId(body),
    };
  },
};

export const SearchBusinessesRequestDto = {
  from(body = {}) {
    return {
      quoi: optionalString(body.quoi, { max: 500 }),
      ou: optionalString(body.ou, { max: 300 }),
      ...normalizeBudgetCurrency(body),
      refine: optionalString(body.refine, { max: 400 }) || '',
      avoid: Array.isArray(body.avoid) ? body.avoid : [],
      projectId: optionalProjectId(body),
    };
  },
};

export const LocationSuggestQueryDto = {
  from(query = {}) {
    return {
      q: optionalString(query.q, { max: 120 }) || '',
    };
  },
};

export const SearchTrainingsRequestDto = {
  from(body = {}) {
    return {
      business: optionalString(body.business, { max: 200 }),
      businessActivity: optionalString(body.businessActivity, { max: 200 }) || '',
      businessPitch: optionalString(body.businessPitch, { max: 500 }) || '',
      businessRationale: optionalString(body.businessRationale, { max: 500 }) || '',
      quoi: optionalString(body.quoi, { max: 300 }) || '',
      ou: optionalString(body.ou, { max: 200 }) || '',
      ...normalizeBudgetCurrency(body),
      refine: optionalString(body.refine, { max: 400 }) || '',
      avoid: Array.isArray(body.avoid) ? body.avoid : [],
      projectId: optionalProjectId(body),
    };
  },
};

export const SearchLocationsRequestDto = {
  from(body = {}) {
    return {
      business: optionalString(body.business, { max: 200 }),
      businessActivity: optionalString(body.businessActivity, { max: 200 }) || '',
      businessPitch: optionalString(body.businessPitch, { max: 500 }) || '',
      businessRationale: optionalString(body.businessRationale, { max: 500 }) || '',
      ou: optionalString(body.ou, { max: 200 }) || '',
      ...normalizeBudgetCurrency(body),
      refine: optionalString(body.refine, { max: 400 }) || '',
      avoid: Array.isArray(body.avoid) ? body.avoid : [],
      projectId: optionalProjectId(body),
    };
  },
};

export const BuildProposalsRequestDto = {
  from(body = {}) {
    return {
      business: optionalString(body.business, { max: 200 }),
      location: optionalString(body.location, { max: 300 }),
      ...normalizeBudgetCurrency(body),
      refine: optionalString(body.refine, { max: 400 }) || '',
      projectId: optionalProjectId(body),
    };
  },
};

export const CreateProjectRequestDto = {
  from(body = {}) {
    return {
      quoi: optionalString(body.quoi, { max: 500 }),
      ou: optionalString(body.ou, { max: 300 }),
      ...normalizeBudgetCurrency(body),
      title: optionalString(body.title, { max: 160 }),
      report: optionalString(body.report, { max: 50_000 }),
      sections: Array.isArray(body.sections) ? body.sections : undefined,
    };
  },
};

export const UpdateProjectRequestDto = {
  from(body = {}) {
    const data = pick(body, ['title', 'status', 'stage', 'legalForm', 'description']);
    if (data.title !== undefined) {
      data.title = optionalString(data.title, { max: 160 });
    }
    if (data.status !== undefined) {
      if (!PROJECT_STATUSES.has(data.status)) {
        throw new AppError('Statut de projet invalide', 400);
      }
    }
    if (data.stage !== undefined) {
      if (!PROJECT_STAGES.has(data.stage)) {
        throw new AppError('Étape de projet invalide', 400);
      }
    }
    if (data.legalForm !== undefined) {
      data.legalForm = optionalString(data.legalForm, { max: 80 });
    }
    if (data.description !== undefined) {
      data.description = optionalString(data.description, { max: 10_000 });
    }
    return data;
  },
};

export const UpdateProjectLocationRequestDto = {
  from(body = {}) {
    return {
      label: optionalString(body.label ?? body.ou, { max: 300 }),
      ou: optionalString(body.ou, { max: 300 }),
      addressLine1: optionalString(body.addressLine1, { max: 200 }),
      addressLine2: optionalString(body.addressLine2, { max: 200 }),
      postalCode: optionalString(body.postalCode, { max: 20 }),
      city: optionalString(body.city, { max: 120 }),
      region: optionalString(body.region, { max: 120 }),
      department: optionalString(body.department, { max: 80 }),
      country: optionalString(body.country, { max: 2 }) || 'FR',
      latitude: body.latitude != null && body.latitude !== '' ? Number(body.latitude) : null,
      longitude: body.longitude != null && body.longitude !== '' ? Number(body.longitude) : null,
    };
  },
};

export const ProjectIdParamDto = {
  from(params) {
    return { id: parseId(params.id) };
  },
};

export const ProjectResponseDto = {
  from(project) {
    if (!project) return null;
    return project;
  },
  fromMany(projects) {
    return (projects || []).map((p) => ProjectResponseDto.from(p));
  },
};
