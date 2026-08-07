import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { CalendarDays, Gauge, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "../components/ui";
import { vehiclesApi } from "../services/vehicles";
import {
  vehicleHistoryApi,
  type HistoryEventType,
  type HistoryInput,
} from "../services/vehicleHistory";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../lib/permissions";
import { historyEventLabels } from "../i18n/pt-BR";
import { formatDateTime, formatMileage, formatPlate } from "../i18n/formatters";
const empty: HistoryInput = { eventType: "NOTE", title: "", description: "" };
export function VehicleHistoryPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [type, setType] = useState<HistoryEventType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HistoryInput>(empty);
  const [error, setError] = useState("");
  const vehicle = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => vehiclesApi.get(id),
    enabled: Boolean(id),
  });
  const history = useQuery({
    queryKey: ["vehicle-history", id, page, type, from, to],
    queryFn: () =>
      vehicleHistoryApi.list(id, {
        page,
        limit: 20,
        eventType: type || undefined,
        dateFrom: from || undefined,
        dateTo: to || undefined,
        sortOrder: "desc",
      }),
    enabled: Boolean(id),
  });
  const create = useMutation({
    mutationFn: (input: HistoryInput) => vehicleHistoryApi.create(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["vehicle-history", id] });
      void client.invalidateQueries({ queryKey: ["vehicle", id] });
      setOpen(false);
      setForm(empty);
    },
    onError: () => setError("Não foi possível adicionar a anotação."),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    create.mutate(form);
  };
  const item = vehicle.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico do Veículo"
        description="Linha do tempo do veículo"
        action={
          hasPermission(user, "vehicle_history.create") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Adicionar anotação
            </Button>
          ) : undefined
        }
      />
      {item && (
        <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs uppercase text-slate-500">Placa</p>
            <p className="font-bold">{formatPlate(item.plate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Veículo</p>
            <p className="font-semibold">
              {item.brand} {item.model}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Ano</p>
            <p>{item.yearModel || item.yearManufacture || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Cliente</p>
            <p>{item.customer.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">
              Quilometragem atual
            </p>
            <p>
              {item.currentMileage == null
                ? "—"
                : formatMileage(item.currentMileage)}
            </p>
          </div>
        </Card>
      )}
      <Card>
        <div className="grid gap-3 border-b p-4 md:grid-cols-3">
          <Select
            aria-label="Filtrar tipo de evento"
            value={type}
            onChange={(event) => {
              setType(event.target.value as HistoryEventType | "");
              setPage(1);
            }}
          >
            <option value="">Todos os eventos</option>
            {Object.entries(historyEventLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Data inicial"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          <Input
            aria-label="Data final"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {history.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Carregando histórico...
          </div>
        ) : history.isError ? (
          <EmptyState
            title="Não foi possível carregar o histórico."
            description="Tente novamente em alguns instantes."
          />
        ) : !history.data?.data.length ? (
          <EmptyState
            title="Este veículo ainda não possui eventos no histórico."
            description="Adicione uma anotação para iniciar a linha do tempo."
          />
        ) : (
          <>
            <div className="divide-y">
              {history.data.data.map((event) => (
                <article key={event.id} className="flex gap-4 p-4">
                  <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-full bg-purple-50 text-purple-700">
                    {event.mileage != null ? (
                      <Gauge className="size-4" />
                    ) : (
                      <CalendarDays className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ink">{event.title}</h2>
                      <Badge tone={event.isManual ? "info" : "neutral"}>
                        {historyEventLabels[event.eventType]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(event.eventDate)} ·{" "}
                      {event.actor?.name || "Sistema"}
                      {event.branch ? ` · ${event.branch.name}` : ""}
                    </p>
                    {event.description && (
                      <p className="mt-2 text-sm text-slate-700">
                        {event.description}
                      </p>
                    )}
                    {event.mileage != null && (
                      <p className="mt-2 text-sm font-semibold text-purple-700">
                        {formatMileage(event.mileage)}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500">
              <span>{history.data.pagination.total} eventos</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= history.data.pagination.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      <Modal
        open={open}
        title="Adicionar anotação"
        onClose={() => setOpen(false)}
      >
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label
              className="mb-1 block text-sm font-semibold"
              htmlFor="history-type"
            >
              Tipo
            </label>
            <Select
              id="history-type"
              value={form.eventType}
              onChange={(event) =>
                setForm({
                  ...form,
                  eventType: event.target.value as HistoryInput["eventType"],
                })
              }
            >
              <option value="NOTE">{historyEventLabels.NOTE}</option>
              <option value="MILEAGE_RECORDED">
                {historyEventLabels.MILEAGE_RECORDED}
              </option>
              <option value="OWNER_CHANGED">
                {historyEventLabels.OWNER_CHANGED}
              </option>
              <option value="GENERAL">{historyEventLabels.GENERAL}</option>
            </Select>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-semibold"
              htmlFor="history-title"
            >
              Título
            </label>
            <Input
              id="history-title"
              required
              maxLength={180}
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-semibold"
              htmlFor="history-description"
            >
              Descrição
            </label>
            <Textarea
              id="history-description"
              maxLength={5000}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="history-mileage"
              >
                Quilometragem
              </label>
              <Input
                id="history-mileage"
                type="number"
                min={0}
                max={100000000}
                required={form.eventType === "MILEAGE_RECORDED"}
                value={form.mileage ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    mileage: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="history-date"
              >
                Data e hora
              </label>
              <Input
                id="history-date"
                type="datetime-local"
                onChange={(event) =>
                  setForm({
                    ...form,
                    eventDate: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : undefined,
                  })
                }
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Salvando..." : "Salvar evento"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
