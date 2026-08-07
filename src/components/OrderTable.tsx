import { MoreHorizontal } from "lucide-react";
import { orders } from "../mocks/data";
import { Badge, IconButton, Pagination } from "./ui";
const tone = (s: string) =>
  s === "Finalizada"
    ? "success"
    : s === "Aguardando peça"
      ? "warning"
      : s === "Orçamento"
        ? "info"
        : "neutral";
export function OrderTable() {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                "Ordem",
                "Cliente / veículo",
                "Serviço",
                "Status",
                "Valor",
                "",
              ].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-semibold text-brand-700">
                  {o.id}
                </td>
                <td className="px-4 py-4">
                  <strong>{o.client}</strong>
                  <br />
                  <span className="text-xs text-slate-500">{o.vehicle}</span>
                </td>
                <td className="px-4 py-4">{o.service}</td>
                <td className="px-4 py-4">
                  <Badge tone={tone(o.status)}>{o.status}</Badge>
                </td>
                <td className="px-4 py-4 font-semibold">{o.value}</td>
                <td className="px-4 py-4">
                  <IconButton label="Mais opções">
                    <MoreHorizontal className="size-4" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination />
    </div>
  );
}
