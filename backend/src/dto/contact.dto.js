import { optionalId, optionalString, optionalStringArray, parseId, pick, requireString } from './helpers.js';

const CONTACT_KEYS = [
  'displayName',
  'email',
  'phone',
  'role',
  'companyName',
  'notes',
  'projectId',
];

export const ContactResponseDto = {
  from(contact) {
    if (!contact) return null;
    return contact;
  },
  fromMany(contacts) {
    return (contacts || []).map((c) => ContactResponseDto.from(c));
  },
};

export const CreateContactRequestDto = {
  from(body = {}) {
    const data = pick(body, CONTACT_KEYS);
    return {
      displayName: requireString(data.displayName, 'displayName', { min: 1, max: 200 }),
      email: optionalString(data.email, { max: 255 }),
      phone: optionalString(data.phone, { max: 40 }),
      role: optionalString(data.role, { max: 80 }),
      companyName: optionalString(data.companyName, { max: 200 }),
      notes: optionalString(data.notes, { max: 2000 }),
      projectId: optionalId(data.projectId, 'projectId'),
    };
  },
};

export const UpdateContactRequestDto = {
  from(body = {}) {
    const data = pick(body, CONTACT_KEYS);
    const out = {};
    if (data.displayName !== undefined) {
      out.displayName = requireString(data.displayName, 'displayName', { min: 1, max: 200 });
    }
    if (data.email !== undefined) out.email = optionalString(data.email, { max: 255 });
    if (data.phone !== undefined) out.phone = optionalString(data.phone, { max: 40 });
    if (data.role !== undefined) out.role = optionalString(data.role, { max: 80 });
    if (data.companyName !== undefined) {
      out.companyName = optionalString(data.companyName, { max: 200 });
    }
    if (data.notes !== undefined) out.notes = optionalString(data.notes, { max: 2000 });
    if (data.projectId !== undefined) out.projectId = optionalId(data.projectId, 'projectId');
    return out;
  },
};

export const ContactIdParamDto = {
  from(params) {
    return { id: parseId(params.id) };
  },
};
