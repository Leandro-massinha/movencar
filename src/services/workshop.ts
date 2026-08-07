import { api } from "./api";

export type ObservationStatus =
  "OK" | "ISSUE" | "NOT_CHECKED" | "NOT_APPLICABLE";
export type DamageLocation =
  | "FRONT_BUMPER"
  | "HOOD"
  | "ROOF"
  | "FRONT_LEFT_DOOR"
  | "FRONT_RIGHT_DOOR"
  | "REAR_LEFT_DOOR"
  | "REAR_RIGHT_DOOR"
  | "TRUNK_LID"
  | "REAR_BUMPER"
  | "LEFT_MIRROR"
  | "RIGHT_MIRROR"
  | "WINDSHIELD"
  | "FRONT_LEFT_WHEEL"
  | "FRONT_RIGHT_WHEEL"
  | "REAR_LEFT_WHEEL"
  | "REAR_RIGHT_WHEEL"
  | "INTERIOR"
  | "DASHBOARD"
  | "TRUNK"
  | "OTHER";
export interface ChecklistItem {
  id: string;
  title: string;
  responseType: "STATUS" | "TEXT" | "NUMBER" | "SELECT";
  isRequired: boolean;
  options?: string[] | null;
}
export interface ChecklistResult {
  id: string;
  itemId: string;
  status?: ObservationStatus | null;
  textValue?: string | null;
  numericValue?: number | null;
  selectedValue?: string | null;
  note?: string | null;
}
export interface Damage {
  id: string;
  location: DamageLocation;
  damageType: string;
  severity: string;
  description?: string | null;
  observedAt: string;
}
export interface CheckInWorkspace {
  workOrder: {
    id: string;
    number: number;
    customer: { id: string; name: string };
    vehicle: { id: string; plate: string | null; brand: string; model: string };
    attendant: { id: string; name: string };
  };
  checkIn: {
    id: string;
    status: "DRAFT" | "COMPLETED" | "CONFIRMED" | "CANCELLED";
    mileage: number | null;
    fuelLevel: number | null;
    generalNotes: string | null;
    checklistInstance: {
      id: string;
      status: string;
      templateVersion: number;
      template: {
        name: string;
        sections: Array<{ id: string; title: string; items: ChecklistItem[] }>;
      };
      results: ChecklistResult[];
    };
    damages: Damage[];
  };
}
export interface Finding {
  id: string;
  category: string;
  status: ObservationStatus;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  recommendation?: string | null;
  requiresImmediateAttention: boolean;
  sequence: number;
}
export interface PdcWorkspace {
  workOrder: CheckInWorkspace["workOrder"];
  concerns: Array<{ id: string; description: string; sequence: number }>;
  checkIn: { status: string; mileage: number | null; damages: Damage[] } | null;
  pdc: {
    id: string;
    status: "DRAFT" | "COMPLETED" | "CANCELLED";
    mileage: number | null;
    generalNotes: string | null;
    technician: { id: string; name: string };
    findings: Finding[];
  } | null;
}

const useMocks = import.meta.env.VITE_USE_MOCKS !== "false";
const statusItems = (prefix: string, titles: string[]): ChecklistItem[] =>
  titles.map((title, index) => ({
    id: `${prefix}-${index}`,
    title,
    responseType: "STATUS",
    isRequired: true,
  }));
const mockCheckIn: CheckInWorkspace = {
  workOrder: {
    id: "demo-os-1842",
    number: 1842,
    customer: { id: "demo-customer", name: "Juliana Alves" },
    vehicle: {
      id: "demo-vehicle",
      plate: "ABC1D23",
      brand: "Chevrolet",
      model: "Onix",
    },
    attendant: { id: "demo-user", name: "Marcos Lima" },
  },
  checkIn: {
    id: "demo-checkin",
    status: "DRAFT",
    mileage: 42800,
    fuelLevel: 50,
    generalNotes: null,
    damages: [],
    checklistInstance: {
      id: "demo-list",
      status: "DRAFT",
      templateVersion: 1,
      template: {
        name: "Check-in padrão — Oficina geral",
        sections: [
          {
            id: "exterior",
            title: "Exterior",
            items: statusItems("ext", [
              "Para-choque dianteiro",
              "Capô",
              "Porta dianteira esquerda",
              "Porta dianteira direita",
              "Teto",
              "Para-choque traseiro",
            ]),
          },
          {
            id: "pneus",
            title: "Rodas e pneus",
            items: statusItems("pneu", [
              "Pneu dianteiro esquerdo",
              "Pneu dianteiro direito",
              "Pneu traseiro esquerdo",
              "Pneu traseiro direito",
              "Estepe",
            ]),
          },
          {
            id: "painel",
            title: "Painel",
            items: statusItems("painel", [
              "Luz de injeção",
              "ABS",
              "Airbag",
              "Óleo",
              "Bateria",
              "Temperatura",
              "Freio",
              "TPMS",
            ]),
          },
          {
            id: "func",
            title: "Funcionamento básico",
            items: statusItems("func", [
              "Motor dá partida",
              "Faróis",
              "Setas",
              "Buzina",
              "Vidros",
              "Travas",
              "Limpador",
              "Ar-condicionado",
              "Freio de estacionamento",
            ]),
          },
          {
            id: "itens",
            title: "Itens entregues/presentes",
            items: statusItems("item", [
              "Chave principal",
              "Chave reserva",
              "Documento",
              "Manual",
              "Macaco",
              "Chave de roda",
              "Triângulo",
              "Tapetes",
            ]),
          },
        ],
      },
      results: [],
    },
  },
};
let mockPdc: PdcWorkspace["pdc"] = null;

export const workshopApi = {
  getCheckIn: async (id: string) =>
    useMocks
      ? structuredClone(mockCheckIn)
      : api
          .get<CheckInWorkspace>(`/work-orders/${id}/check-in/workspace`)
          .then(({ data }) => data),
  createCheckIn: async (id: string) =>
    useMocks
      ? mockCheckIn.checkIn
      : api
          .post(`/work-orders/${id}/check-in`, {})
          .then(({ data }) => data.checkIn),
  updateCheckIn: async (
    id: string,
    input: {
      mileage?: number;
      fuelLevel?: number;
      generalNotes?: string | null;
    },
  ) => {
    if (useMocks) {
      Object.assign(mockCheckIn.checkIn, input);
      return mockCheckIn.checkIn;
    }
    return api
      .patch(`/work-orders/${id}/check-in`, input)
      .then(({ data }) => data.checkIn);
  },
  saveResult: async (
    id: string,
    itemId: string,
    input: Partial<ChecklistResult>,
  ) => {
    if (useMocks) {
      const result = { id: `result-${itemId}`, itemId, ...input };
      mockCheckIn.checkIn.checklistInstance.results = [
        ...mockCheckIn.checkIn.checklistInstance.results.filter(
          (item) => item.itemId !== itemId,
        ),
        result,
      ];
      return result;
    }
    return api
      .put(`/work-orders/${id}/check-in/checklist/items/${itemId}`, input)
      .then(({ data }) => data.result);
  },
  createDamage: async (
    id: string,
    input: Omit<Damage, "id" | "observedAt">,
  ) => {
    if (useMocks) {
      const damage = {
        ...input,
        id: crypto.randomUUID(),
        observedAt: new Date().toISOString(),
      };
      mockCheckIn.checkIn.damages.push(damage);
      return damage;
    }
    return api
      .post(`/work-orders/${id}/check-in/damages`, input, {
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
      .then(({ data }) => data.damage);
  },
  completeCheckIn: async (id: string) => {
    if (useMocks) {
      mockCheckIn.checkIn.status = "COMPLETED";
      mockCheckIn.checkIn.checklistInstance.status = "COMPLETED";
      return mockCheckIn.checkIn;
    }
    return api
      .post(`/work-orders/${id}/check-in/complete`)
      .then(({ data }) => data.checkIn);
  },
  getPdc: async (id: string): Promise<PdcWorkspace> =>
    useMocks
      ? {
          workOrder: mockCheckIn.workOrder,
          concerns: [
            {
              id: "concern-1",
              description: "Ruído ao frear em baixa velocidade.",
              sequence: 1,
            },
          ],
          checkIn: {
            status: mockCheckIn.checkIn.status,
            mileage: mockCheckIn.checkIn.mileage,
            damages: mockCheckIn.checkIn.damages,
          },
          pdc: structuredClone(mockPdc),
        }
      : api
          .get<PdcWorkspace>(`/work-orders/${id}/pdc`)
          .then(({ data }) => data),
  createPdc: async (
    id: string,
    input: { mileage?: number; generalNotes?: string | null },
  ) => {
    if (useMocks) {
      mockPdc = {
        id: "demo-pdc",
        status: "DRAFT",
        mileage: input.mileage ?? mockCheckIn.checkIn.mileage,
        generalNotes: input.generalNotes ?? null,
        technician: { id: "demo-user", name: "Marcos Lima" },
        findings: [],
      };
      return structuredClone(mockPdc);
    }
    return api
      .post(`/work-orders/${id}/pdc`, input, {
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
      .then(({ data }) => data.pdc);
  },
  updatePdc: async (
    id: string,
    input: { mileage?: number; generalNotes?: string | null },
  ) => {
    if (useMocks && mockPdc) {
      Object.assign(mockPdc, input);
      return structuredClone(mockPdc);
    }
    return api
      .patch(`/work-orders/${id}/pdc`, input)
      .then(({ data }) => data.pdc);
  },
  addFinding: async (id: string, input: Omit<Finding, "id" | "sequence">) => {
    if (useMocks && mockPdc) {
      const finding = {
        ...input,
        id: crypto.randomUUID(),
        sequence: mockPdc.findings.length + 1,
      };
      mockPdc.findings.push(finding);
      return finding;
    }
    return api
      .post(`/work-orders/${id}/pdc/findings`, input)
      .then(({ data }) => data.finding);
  },
  completePdc: async (id: string) => {
    if (useMocks && mockPdc) {
      mockPdc.status = "COMPLETED";
      return structuredClone(mockPdc);
    }
    return api
      .post(`/work-orders/${id}/pdc/complete`)
      .then(({ data }) => data.pdc);
  },
};
