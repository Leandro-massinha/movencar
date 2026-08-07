import { LayoutDashboard, CalendarDays, CarFront, ClipboardList, WalletCards, UsersRound, Warehouse, Wrench, Building2, Star, Settings, FileCheck2 } from 'lucide-react'
import type { Permission } from '../types/auth'

export const navigation = [
  { group:'OPERACAO', label:'Visao geral', path:'/', icon:LayoutDashboard, permission:'dashboard.view' },
  { group:'OPERACAO', label:'Agenda', path:'/agenda', icon:CalendarDays, permission:'agenda.view' },
  { group:'OPERACAO', label:'Patio', path:'/patio', icon:Warehouse, permission:'yard.view' },
  { group:'OFICINA', label:'Clientes', path:'/clientes', icon:UsersRound, permission:'customers.view' },
  { group:'OFICINA', label:'Veiculos', path:'/veiculos', icon:CarFront, permission:'vehicles.view' },
  { group:'OFICINA', label:'Checklists', path:'/checklists', icon:FileCheck2, permission:'orders.view' },
  { group:'OFICINA', label:'Ordens de servico', path:'/ordens-servico', icon:ClipboardList, permission:'orders.view' },
  { group:'GESTAO', label:'Ferramentas', path:'/ferramentas', icon:Wrench, permission:'tools.view' },
  { group:'GESTAO', label:'Financeiro', path:'/financeiro', icon:WalletCards, permission:'finance.view' },
  { group:'GESTAO', label:'Centros de custo', path:'/centros-custo', icon:Building2, permission:'finance.view' },
  { group:'GESTAO', label:'Avaliacoes', path:'/avaliacoes', icon:Star, permission:'crm.view' },
  { group:'ADMINISTRACAO', label:'Configuracoes', path:'/configuracoes', icon:Settings, permission:'settings.manage' },
] satisfies {group:string;label:string;path:string;icon:typeof LayoutDashboard;permission:Permission}[]
