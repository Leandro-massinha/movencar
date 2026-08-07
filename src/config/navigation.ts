import {
  LayoutDashboard,
  CalendarDays,
  CarFront,
  ClipboardList,
  WalletCards,
  UsersRound,
  Warehouse,
  Wrench,
  Building2,
  Star,
  Settings,
  FileCheck2,
} from "lucide-react";
import type { Permission } from "../types/auth";

export const navigation = [
  {
    group: "OPERAÇÃO",
    label: "Visão Geral",
    path: "/",
    icon: LayoutDashboard,
    permission: "dashboard.view",
    module: "core",
  },
  {
    group: "OPERAÇÃO",
    label: "Agenda",
    path: "/agenda",
    icon: CalendarDays,
    permission: "agenda.view",
    module: "workshop",
  },
  {
    group: "OPERAÇÃO",
    label: "Pátio",
    path: "/patio",
    icon: Warehouse,
    permission: "yard.view",
    module: "yard",
  },
  {
    group: "OFICINA",
    label: "Clientes",
    path: "/clientes",
    icon: UsersRound,
    permission: "customers.view",
    module: "customers",
  },
  {
    group: "OFICINA",
    label: "Veículos",
    path: "/veiculos",
    icon: CarFront,
    permission: "vehicles.view",
    module: "vehicles",
  },
  {
    group: "OFICINA",
    label: "Listas de Verificação",
    path: "/checklists",
    icon: FileCheck2,
    permission: "orders.view",
    module: "workshop",
  },
  {
    group: "OFICINA",
    label: "Ordens de Serviço",
    path: "/ordens-servico",
    icon: ClipboardList,
    permission: "orders.view",
    module: "workshop",
  },
  {
    group: "GESTÃO",
    label: "Ferramentas",
    path: "/ferramentas",
    icon: Wrench,
    permission: "tools.view",
    module: "tools-assets",
  },
  {
    group: "GESTÃO",
    label: "Financeiro",
    path: "/financeiro",
    icon: WalletCards,
    permission: "finance.view",
    module: "finance",
  },
  {
    group: "GESTÃO",
    label: "Centros de Custos",
    path: "/centros-custo",
    icon: Building2,
    permission: "finance.view",
    module: "finance",
  },
  {
    group: "GESTÃO",
    label: "Avaliações",
    path: "/avaliacoes",
    icon: Star,
    permission: "crm.view",
    module: "crm",
  },
  {
    group: "ADMINISTRAÇÃO",
    label: "Configurações",
    path: "/configuracoes",
    icon: Settings,
    permission: "settings.manage",
    module: "core",
  },
] satisfies {
  group: string;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  module: string;
}[];
