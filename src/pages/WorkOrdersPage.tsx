import { ClipboardCheck, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, EmptyState, PageHeader } from "../components/ui";
import { getPublicErrorMessage } from "../services/api";
import { workshopApi, type WorkOrderSummary } from "../services/workshop";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../lib/permissions";

export function WorkOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<WorkOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setOrders(await workshopApi.listWorkOrders());
      setError("");
    } catch (cause) {
      setError(
        getPublicErrorMessage(cause, "Não foi possível carregar as Ordens de Serviço."),
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Serviço"
        description="Acesse o Check-in e o PDC pelo fluxo da oficina"
      />
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <Card className="overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Carregando Ordens de Serviço...</p>
        ) : orders.length === 0 ? (
          <EmptyState title="Nenhuma Ordem de Serviço encontrada" description="Abra uma Ordem de Serviço para iniciar o fluxo da oficina." />
        ) : (
          <div className="divide-y">
            {orders.map((order) => (
              <article key={order.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>OS #{order.number}</strong>
                    <Badge tone={order.status === "OPEN" ? "info" : "neutral"}>{order.status === "OPEN" ? "Aberta" : "Encerrada"}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium">{order.customer.name}</p>
                  <p className="text-sm text-slate-500">{order.vehicle.brand} {order.vehicle.model} · {order.vehicle.plate ?? "Sem placa"}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {hasPermission(user, "checkins.view") && <Link to={`/ordens-servico/${order.id}/check-in`}><Button variant="secondary" className="w-full"><ClipboardCheck className="size-4" />Abrir Check-in</Button></Link>}
                  {hasPermission(user, "pdc.view") && <Link to={`/ordens-servico/${order.id}/pdc`}><Button className="w-full"><Stethoscope className="size-4" />Abrir PDC</Button></Link>}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
