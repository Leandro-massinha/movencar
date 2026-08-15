import { api } from "./api";

export type CheckInEvidenceCategory =
  | "FRONT"
  | "REAR"
  | "LEFT_SIDE"
  | "RIGHT_SIDE"
  | "DASHBOARD"
  | "ODOMETER"
  | "FUEL"
  | "INTERIOR_FRONT"
  | "INTERIOR_REAR"
  | "TRUNK"
  | "ENGINE_BAY"
  | "OTHER";

export interface PhotoEvidence {
  id: string;
  category?: CheckInEvidenceCategory;
  caption: string | null;
  sequence: number;
  originalFilename: string;
  detectedMimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader: { id: string; name: string };
}

type UploadInput = {
  file: File;
  caption?: string;
  category?: CheckInEvidenceCategory;
};

const useMocks = import.meta.env.VITE_USE_MOCKS !== "false";
const generalMock = new Map<string, PhotoEvidence[]>();
const damageMock = new Map<string, PhotoEvidence[]>();
const checklistItemMock = new Map<string, PhotoEvidence[]>();
const mockBlobs = new Map<string, Blob>();

const damageKey = (workOrderId: string, damageId: string) =>
  `${workOrderId}:${damageId}`;

function formData(input: UploadInput) {
  const body = new FormData();
  body.append("file", input.file);
  if (input.caption?.trim()) body.append("caption", input.caption.trim());
  if (input.category) body.append("category", input.category);
  return body;
}

function mockUpload(target: PhotoEvidence[], input: UploadInput) {
  const evidence: PhotoEvidence = {
    id: crypto.randomUUID(),
    ...(input.category ? { category: input.category } : {}),
    caption: input.caption?.trim() || null,
    sequence: Math.max(0, ...target.map(({ sequence }) => sequence)) + 1,
    originalFilename: input.file.name,
    detectedMimeType: input.file.type,
    sizeBytes: input.file.size,
    createdAt: new Date().toISOString(),
    uploader: { id: "demo-user", name: "Marcos Lima" },
  };
  target.push(evidence);
  mockBlobs.set(evidence.id, input.file);
  return structuredClone(evidence);
}

function mockDelete(target: PhotoEvidence[], evidenceId: string) {
  const index = target.findIndex(({ id }) => id === evidenceId);
  if (index >= 0) target.splice(index, 1);
  mockBlobs.delete(evidenceId);
}

export const photoEvidenceApi = {
  listCheckIn: async (workOrderId: string): Promise<PhotoEvidence[]> =>
    useMocks
      ? structuredClone(generalMock.get(workOrderId) ?? [])
      : api
          .get<{ data: PhotoEvidence[] }>(
            `/work-orders/${workOrderId}/check-in/evidence`,
          )
          .then(({ data }) => data.data),

  uploadCheckIn: async (workOrderId: string, input: UploadInput) => {
    if (useMocks) {
      const target = generalMock.get(workOrderId) ?? [];
      generalMock.set(workOrderId, target);
      return mockUpload(target, input);
    }
    return api
      .post<{ evidence: PhotoEvidence }>(
        `/work-orders/${workOrderId}/check-in/evidence`,
        formData(input),
      )
      .then(({ data }) => data.evidence);
  },

  getCheckInContent: async (workOrderId: string, evidenceId: string) =>
    useMocks
      ? mockContent(evidenceId)
      : api
          .get<Blob>(
            `/work-orders/${workOrderId}/check-in/evidence/${evidenceId}/content`,
            { responseType: "blob" },
          )
          .then(({ data }) => data),

  deleteCheckIn: async (workOrderId: string, evidenceId: string) => {
    if (useMocks) {
      mockDelete(generalMock.get(workOrderId) ?? [], evidenceId);
      return;
    }
    await api.delete(
      `/work-orders/${workOrderId}/check-in/evidence/${evidenceId}`,
    );
  },

  listDamage: async (workOrderId: string, damageId: string) => {
    const key = damageKey(workOrderId, damageId);
    return useMocks
      ? structuredClone(damageMock.get(key) ?? [])
      : api
          .get<{ data: PhotoEvidence[] }>(
            `/work-orders/${workOrderId}/check-in/damages/${damageId}/evidence`,
          )
          .then(({ data }) => data.data);
  },

  uploadDamage: async (
    workOrderId: string,
    damageId: string,
    input: Omit<UploadInput, "category">,
  ) => {
    const key = damageKey(workOrderId, damageId);
    if (useMocks) {
      const target = damageMock.get(key) ?? [];
      damageMock.set(key, target);
      return mockUpload(target, input);
    }
    return api
      .post<{ evidence: PhotoEvidence }>(
        `/work-orders/${workOrderId}/check-in/damages/${damageId}/evidence`,
        formData(input),
      )
      .then(({ data }) => data.evidence);
  },

  getDamageContent: async (
    workOrderId: string,
    damageId: string,
    evidenceId: string,
  ) =>
    useMocks
      ? mockContent(evidenceId)
      : api
          .get<Blob>(
            `/work-orders/${workOrderId}/check-in/damages/${damageId}/evidence/${evidenceId}/content`,
            { responseType: "blob" },
          )
          .then(({ data }) => data),

  deleteDamage: async (
    workOrderId: string,
    damageId: string,
    evidenceId: string,
  ) => {
    if (useMocks) {
      mockDelete(damageMock.get(damageKey(workOrderId, damageId)) ?? [], evidenceId);
      return;
    }
    await api.delete(
      `/work-orders/${workOrderId}/check-in/damages/${damageId}/evidence/${evidenceId}`,
    );
  },

  listChecklistItem: async (workOrderId: string, itemResultId: string) => {
    const key = `${workOrderId}:${itemResultId}`;
    return useMocks
      ? structuredClone(checklistItemMock.get(key) ?? [])
      : api.get<{ data: PhotoEvidence[] }>(`/work-orders/${workOrderId}/check-in/checklist/items/${itemResultId}/evidence`).then(({ data }) => data.data);
  },

  uploadChecklistItem: async (workOrderId: string, itemResultId: string, input: Omit<UploadInput, "category">) => {
    const key = `${workOrderId}:${itemResultId}`;
    if (useMocks) {
      const target = checklistItemMock.get(key) ?? [];
      checklistItemMock.set(key, target);
      return mockUpload(target, input);
    }
    return api.post<{ evidence: PhotoEvidence }>(`/work-orders/${workOrderId}/check-in/checklist/items/${itemResultId}/evidence`, formData(input)).then(({ data }) => data.evidence);
  },

  getChecklistItemContent: async (workOrderId: string, itemResultId: string, evidenceId: string) =>
    useMocks ? mockContent(evidenceId) : api.get<Blob>(`/work-orders/${workOrderId}/check-in/checklist/items/${itemResultId}/evidence/${evidenceId}/content`, { responseType: "blob" }).then(({ data }) => data),

  deleteChecklistItem: async (workOrderId: string, itemResultId: string, evidenceId: string) => {
    if (useMocks) {
      mockDelete(checklistItemMock.get(`${workOrderId}:${itemResultId}`) ?? [], evidenceId);
      return;
    }
    await api.delete(`/work-orders/${workOrderId}/check-in/checklist/items/${itemResultId}/evidence/${evidenceId}`);
  },
};

function mockContent(evidenceId: string) {
  const blob = mockBlobs.get(evidenceId);
  if (!blob) return Promise.reject(new Error("Evidência indisponível"));
  return Promise.resolve(blob);
}
