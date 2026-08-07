import { api } from "./api";
export type HistoryEventType =
  | "VEHICLE_CREATED"
  | "VEHICLE_UPDATED"
  | "MILEAGE_RECORDED"
  | "NOTE"
  | "OWNER_CHANGED"
  | "GENERAL"
  | "WORK_ORDER_OPENED"
  | "CUSTOMER_CONCERN_RECORDED"
  | "CHECK_IN_COMPLETED"
  | "DAMAGE_RECORDED"
  | "PDC_STARTED"
  | "PDC_COMPLETED"
  | "WORK_ORDER_CLOSED_NO_SERVICE"
  | "WORK_ORDER_COMPLETED"
  | "WORK_ORDER_CANCELLED";
export interface HistoryEvent {
  id: string;
  eventType: HistoryEventType;
  title: string;
  description: string | null;
  mileage: number | null;
  eventDate: string;
  isManual: boolean;
  createdAt: string;
  branch: { name: string } | null;
  actor: { name: string } | null;
}
export interface HistoryInput {
  eventType: "NOTE" | "MILEAGE_RECORDED" | "OWNER_CHANGED" | "GENERAL";
  title: string;
  description?: string;
  mileage?: number;
  eventDate?: string;
}
export interface HistoryList {
  data: HistoryEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
const useMocks = import.meta.env.VITE_USE_MOCKS !== "false";
let mockEvents: Record<string, HistoryEvent[]> = {
  "demo-vehicle-1": [
    {
      id: "demo-history-1",
      eventType: "VEHICLE_CREATED",
      title: "Veículo cadastrado",
      description: "Chevrolet Onix",
      mileage: 42800,
      eventDate: new Date(Date.now() - 86400000).toISOString(),
      isManual: false,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      branch: null,
      actor: { name: "Marina Costa" },
    },
    {
      id: "demo-history-2",
      eventType: "NOTE",
      title: "Observação inicial",
      description: "Cliente informou uso predominantemente urbano.",
      mileage: null,
      eventDate: new Date().toISOString(),
      isManual: true,
      createdAt: new Date().toISOString(),
      branch: null,
      actor: { name: "Marina Costa" },
    },
  ],
};
export const vehicleHistoryApi = {
  list: async (
    vehicleId: string,
    params: {
      page: number;
      limit: number;
      eventType?: HistoryEventType;
      dateFrom?: string;
      dateTo?: string;
      sortOrder?: "asc" | "desc";
    },
  ) => {
    if (!useMocks)
      return api
        .get<HistoryList>(`/vehicles/${vehicleId}/history`, { params })
        .then(({ data }) => data);
    let rows = (mockEvents[vehicleId] ?? []).filter(
      (event) =>
        (!params.eventType || event.eventType === params.eventType) &&
        (!params.dateFrom ||
          event.eventDate >= `${params.dateFrom}T00:00:00.000Z`) &&
        (!params.dateTo || event.eventDate <= `${params.dateTo}T23:59:59.999Z`),
    );
    rows = [...rows].sort(
      (a, b) =>
        (params.sortOrder === "asc" ? 1 : -1) *
        a.eventDate.localeCompare(b.eventDate),
    );
    return {
      data: rows.slice(
        (params.page - 1) * params.limit,
        params.page * params.limit,
      ),
      pagination: {
        page: params.page,
        limit: params.limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / params.limit),
      },
    };
  },
  create: async (vehicleId: string, input: HistoryInput) => {
    if (!useMocks)
      return api
        .post<{ event: HistoryEvent }>(`/vehicles/${vehicleId}/history`, input)
        .then(({ data }) => data.event);
    const event: HistoryEvent = {
      id: crypto.randomUUID(),
      eventType: input.eventType,
      title: input.title.trim(),
      description: input.description || null,
      mileage: input.mileage ?? null,
      eventDate: input.eventDate || new Date().toISOString(),
      isManual: true,
      createdAt: new Date().toISOString(),
      branch: null,
      actor: { name: "Marina Costa" },
    };
    mockEvents = {
      ...mockEvents,
      [vehicleId]: [event, ...(mockEvents[vehicleId] ?? [])],
    };
    return event;
  },
};
