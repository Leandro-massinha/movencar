import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui'
import { CompactTable, CustomerReturnList, DailyAgenda, DashboardKpiCard, DashboardSection, LowStockList, MiniKanban, PurchaseList, Receivables, RevenueChart, VehicleMovementList, kpis } from '../components/dashboard'

export function DashboardPage(){return <div className="space-y-4">
  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-[26px] font-bold leading-tight text-slate-900">Visao Geral</h1><p className="mt-0.5 text-sm text-slate-500">Operacao da oficina em tempo real</p></div><div className="flex flex-wrap items-center gap-2"><select aria-label="Periodo" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold"><option>Este mes</option><option>Ultimos 30 dias</option><option>Este trimestre</option></select><Button variant="secondary"><RefreshCw className="size-4"/>Atualizar</Button><Button className="bg-brand-500 text-black hover:bg-brand-600"><Plus className="size-4"/>Nova ordem</Button></div></div>

  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(item=><DashboardKpiCard key={item.title} {...item}/>)}</div>

  <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
    <DashboardSection title="Visao Geral das Ordens de Servico" helper="Fluxo operacional atual" action="Ver todas as ordens" className="xl:col-span-6"><MiniKanban/></DashboardSection>
    <DashboardSection title="Entrada e Saida de Veiculos" helper="Movimentacoes de hoje" action="Ver movimentacoes" className="xl:col-span-3"><VehicleMovementList/></DashboardSection>
    <DashboardSection title="Agenda de Hoje" helper="4 compromissos programados" className="xl:col-span-3"><DailyAgenda/></DashboardSection>
  </div>

  <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
    <DashboardSection title="Ordens de Servico Recentes" action="Abrir ordens" className="xl:col-span-7"><CompactTable/></DashboardSection>
    <DashboardSection title="Estoque Baixo" helper="Itens abaixo do minimo" className="xl:col-span-2"><LowStockList/></DashboardSection>
    <DashboardSection title="Clientes para Retorno" helper="Oportunidades de relacionamento" className="xl:col-span-3"><CustomerReturnList/></DashboardSection>
  </div>

  <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
    <DashboardSection title="Faturamento dos Ultimos 6 Meses" helper="Receita confirmada por competencia" className="xl:col-span-6"><RevenueChart/></DashboardSection>
    <DashboardSection title="Compras Pendentes" helper="Pedidos em acompanhamento" className="xl:col-span-3"><PurchaseList/></DashboardSection>
    <DashboardSection title="Contas a Receber" helper="Resumo dos proximos vencimentos" className="xl:col-span-3"><Receivables/></DashboardSection>
  </div>
</div>}
