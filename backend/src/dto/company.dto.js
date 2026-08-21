import { parseId } from './helpers.js';

export const CompanyResponseDto = {
  from(company) {
    if (!company) return null;
    return company;
  },
  fromMany(companies) {
    return (companies || []).map((c) => CompanyResponseDto.from(c));
  },
};

export const CompanyIdParamDto = {
  from(params) {
    return { id: parseId(params.id) };
  },
};
