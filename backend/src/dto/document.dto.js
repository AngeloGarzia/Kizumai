import { optionalId, optionalString, parseId } from './helpers.js';

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
    const out = {};
    if (body.title !== undefined) {
      out.title = optionalString(body.title, { max: 255 });
    }
    if (body.description !== undefined) {
      out.description = optionalString(body.description, { max: 5000 });
    }
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

function enrichDocument(document) {
  if (!document) return null;
  const attrs = document.attributes || {};
  const processingStatus =
    document.processingStatus ||
    attrs.processingStatus ||
    (document.excerpt ? 'ready' : null);
  return {
    ...document,
    processingStatus,
    processingError: document.processingError ?? attrs.processingError ?? null,
  };
}

export const DocumentResponseDto = {
  from(document) {
    return enrichDocument(document);
  },
  fromMany(documents) {
    return (documents || []).map((d) => DocumentResponseDto.from(d));
  },
};
