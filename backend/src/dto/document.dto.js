import { optionalId, optionalString, parseId, pick } from './helpers.js';

export const DocumentParamsDto = {
  from(params) {
    return {
      projectId: parseId(params.id, 'projectId'),
      documentId: params.docId != null ? parseId(params.docId, 'documentId') : undefined,
    };
  },
};

export const UploadDocumentRequestDto = {
  from(body = {}, file) {
    return {
      title: optionalString(body.title, { max: 255 }),
      categoryId: optionalId(body.categoryId, 'categoryId'),
      description: optionalString(body.description, { max: 5000 }),
      file,
    };
  },
};

export const UpdateDocumentRequestDto = {
  from(body = {}) {
    const out = pick(body, ['title', 'description', 'excerpt']);
    if (body.categoryId !== undefined) {
      out.categoryId = body.categoryId == null || body.categoryId === ''
        ? null
        : parseId(body.categoryId, 'categoryId');
    }
    return out;
  },
};

export const LinkDocumentContactRequestDto = {
  from(body = {}) {
    return {
      contactId: parseId(body.contactId, 'contactId'),
      role: optionalString(body.role, { max: 80 }),
      note: optionalString(body.note, { max: 2000 }),
    };
  },
};

export const DocumentContactParamsDto = {
  from(params) {
    return {
      ...DocumentParamsDto.from(params),
      contactId: parseId(params.contactId, 'contactId'),
    };
  },
};

export const DocumentResponseDto = {
  from(document) {
    if (!document) return null;
    return document;
  },
  fromMany(documents) {
    return (documents || []).map((d) => DocumentResponseDto.from(d));
  },
};
