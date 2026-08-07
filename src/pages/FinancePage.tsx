import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Plus,
  ReceiptText,
} from "lucide-react";
import { Button, Card, KpiCard, PageHeader } from "../components/ui";
import { OrderTable } from "../components/OrderTable";
export function FinancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Fluxo de caixa, recebimentos e compromissos"
        action={
          <Button>
            <Plus className="size-4" />
            Novo lançamento
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Saldo previsto"
          value="R$ 86.240"
          helper="Até 31 de agosto"
          icon={CircleDollarSign}
          tone="blue"
        />
        <KpiCard
          label="Recebimentos"
          value="R$ 42.580"
          helper="18 confirmados no período"
          icon={ArrowDownLeft}
          tone="green"
        />
        <KpiCard
          label="Contas a pagar"
          value="R$ 17.940"
          helper="6 vencem nesta semana"
          icon={ArrowUpRight}
          tone="red"
        />
        <KpiCard
          label="Em atraso"
          value="R$ 3.280"
          helper="4 cobranças pendentes"
          icon={ReceiptText}
          tone="amber"
        />
      </div>
      <Card>
        <header className="border-b p-4">
          <h2 className="font-bold">Lançamentos recentes</h2>
        </header>
        <OrderTable />
      </Card>
    </div>
  );
}
