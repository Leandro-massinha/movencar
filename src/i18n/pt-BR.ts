import type { CustomerStatus, CustomerType } from "../services/customers";
import type { FuelType, VehicleStatus } from "../services/vehicles";
import type { HistoryEventType } from "../services/vehicleHistory";

export const locale = "pt-BR" as const;
export const currency = "BRL" as const;

export const statusLabels: Record<VehicleStatus | CustomerStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  BLOCKED: "Bloqueado",
};
export const customerTypeLabels: Record<CustomerType, string> = {
  INDIVIDUAL: "Pessoa física",
  COMPANY: "Pessoa jurídica",
};
export const fuelTypeLabels: Record<FuelType, string> = {
  GASOLINE: "Gasolina",
  ETHANOL: "Etanol",
  FLEX: "Flex",
  DIESEL: "Diesel",
  ELECTRIC: "Elétrico",
  HYBRID: "Híbrido",
  GNV: "GNV",
  OTHER: "Outro",
};
export const transmissionLabels = {
  MANUAL: "Manual",
  AUTOMATIC: "Automático",
  CVT: "CVT",
  AUTOMATED: "Automatizado",
  OTHER: "Outro",
} as const;
export const historyEventLabels: Record<HistoryEventType, string> = {
  VEHICLE_CREATED: "Veículo cadastrado",
  VEHICLE_UPDATED: "Veículo atualizado",
  MILEAGE_RECORDED: "Quilometragem registrada",
  NOTE: "Anotação",
  OWNER_CHANGED: "Alteração de proprietário",
  GENERAL: "Evento geral",
};
export const moduleStatusLabels = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
  EXPIRED: "Expirado",
} as const;
export const moduleLabels: Record<string, string> = {
  core: "Núcleo da plataforma",
  customers: "Clientes",
  vehicles: "Veículos",
  workshop: "Oficina",
  catalog: "Catálogo",
  inventory: "Estoque",
  purchasing: "Compras",
  sales: "Vendas",
  finance: "Financeiro",
  fiscal: "Fiscal",
  crm: "CRM",
  communication: "Comunicação",
  detailing: "Estética automotiva",
  tires: "Pneus",
  bodyShop: "Funilaria e pintura",
  yard: "Pátio",
  "tools-assets": "Ferramentas e ativos",
};
