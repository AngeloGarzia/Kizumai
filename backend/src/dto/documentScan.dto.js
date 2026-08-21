import {
  optionalIdArray,
  optionalString,
  parseId,
  safePlainObject,
} from './helpers.js';

export const ScanParamsDto = {
  from(params) {
    return {
      projectId: parseId(params.id, 'projectId'),
      scanId: parseId(params.scanId, 'scanId'),
    };
  },
};

export const DocumentScanParamsDto = {
  from(params) {
    return {
      projectId: parseId(params.id, 'projectId'),
      documentId: parseId(params.docId, 'documentId'),
    };
  },
};

export const ApplyScanRequestDto = {
  from(body = {}) {
    const rawEdits = safePlainObject(body.edits, { maxKeys: 80 });
    const edits = {};
    for (const [key, val] of Object.entries(rawEdits)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id < 1) continue;
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      edits[id] = {
        label: optionalString(val.label, { max: 300 }),
        notes: optionalString(val.notes, { max: 2000 }),
        snippet: optionalString(val.snippet, { max: 2000 }),
      };
    }
    return {
      acceptItemIds: optionalIdArray(body.acceptItemIds, { maxItems: 80 }),
      rejectItemIds: optionalIdArray(body.rejectItemIds, { maxItems: 80 }),
      edits,
    };
  },
};
