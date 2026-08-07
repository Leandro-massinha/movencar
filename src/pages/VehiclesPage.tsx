import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
} from "../components/ui";
import {
  vehiclesApi,
  type FuelType,
  type VehicleInput,
  type VehicleStatus,
} from "../services/vehicles";
import { customersApi } from "../services/customers";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../lib/permissions";
import { fuelTypeLabels, statusLabels } from "../i18n/pt-BR";
import { formatMileage, formatPlate } from "../i18n/formatters";
const empty: VehicleInput = {
  customerId: "",
  plate: "",
  brand: "",
  model: "",
  version: "",
  color: "",
};
export function VehiclesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VehicleStatus | "">("");
  const [fuel, setFuel] = useState<FuelType | "">("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VehicleInput>(empty);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["vehicles", page, search, status, fuel],
    queryFn: () =>
      vehiclesApi.list({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
        fuelType: fuel || undefined,
      }),
  });
  const customers = useQuery({
    queryKey: ["customers", "vehicle-select"],
    queryFn: () => customersApi.list({ page: 1, limit: 100, status: "ACTIVE" }),
    enabled: open,
  });
  const create = useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["vehicles"] });
      setOpen(false);
      setForm(empty);
    },
    onError: () =>
      setError(
        "Não foi possível cadastrar o veículo. Verifique os dados informados.",
      ),
  });
  const remove = useMutation({
    mutationFn: vehiclesApi.remove,
    onSuccess: () => void client.invalidateQueries({ queryKey: ["vehicles"] }),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    create.mutate(form);
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículos"
        description="Cadastro de veículos da empresa"
        action={
          hasPermission(user, "vehicles.create") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Novo veículo
            </Button>
          ) : undefined
        }
      />
      <Card>
        <div className="grid gap-3 border-b p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
          <SearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Pesquisar veículos"
            placeholder="Pesquisar por placa, veículo ou cliente..."
          />
          <Select
            aria-label="Filtrar por status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as VehicleStatus | "");
              setPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Inativos</option>
            <option value="BLOCKED">Bloqueados</option>
          </Select>
          <Select
            aria-label="Filtrar por combustível"
            value={fuel}
            onChange={(e) => {
              setFuel(e.target.value as FuelType | "");
              setPage(1);
            }}
          >
            <option value="">Todos combustiveis</option>
            {Object.entries(fuelTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Carregando veículos...
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Não foi possível carregar os veículos."
            description="Tente novamente em alguns instantes."
          />
        ) : !query.data?.data.length ? (
          <EmptyState
            title="Nenhum veículo encontrado."
            description="Não encontramos resultados para os filtros informados."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Placa</th>
                    <th className="px-4 py-3">Veículo</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Ano</th>
                    <th className="px-4 py-3">Quilometragem</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Filial de origem</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {query.data.data.map((vehicle) => (
                    <tr key={vehicle.id} className="h-16">
                      <td className="px-4 font-bold text-ink">
                        {formatPlate(vehicle.plate)}
                      </td>
                      <td className="px-4">
                        <p className="font-semibold">
                          {vehicle.brand} {vehicle.model}
                        </p>
                        <p className="text-xs text-slate-500">
                          {vehicle.version || vehicle.color || "Sem versão"}
                        </p>
                      </td>
                      <td className="px-4">{vehicle.customer.name}</td>
                      <td className="px-4">
                        {vehicle.yearManufacture && vehicle.yearModel
                          ? `${vehicle.yearManufacture}/${vehicle.yearModel}`
                          : vehicle.yearModel || vehicle.yearManufacture || "—"}
                      </td>
                      <td className="px-4">
                        {vehicle.currentMileage == null
                          ? "—"
                          : formatMileage(vehicle.currentMileage)}
                      </td>
                      <td className="px-4">
                        <Badge
                          tone={
                            vehicle.status === "ACTIVE"
                              ? "success"
                              : vehicle.status === "BLOCKED"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {statusLabels[vehicle.status]}
                        </Badge>
                      </td>
                      <td className="px-4">
                        {vehicle.originBranch?.name || "Todas as filiais"}
                      </td>
                      <td className="px-4 text-right">
                        <span className="inline-flex gap-2">
                          <IconButton
                            label={`Histórico de ${vehicle.brand} ${vehicle.model}`}
                            onClick={() =>
                              navigate(`/veiculos/${vehicle.id}/historico`)
                            }
                          >
                            <History className="size-4" />
                          </IconButton>
                          {hasPermission(user, "vehicles.delete") && (
                            <IconButton
                              label={`Excluir ${vehicle.brand} ${vehicle.model}`}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Excluir veículo ${vehicle.plate || vehicle.model}? O histórico será preservado.`,
                                  )
                                )
                                  remove.mutate(vehicle.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </IconButton>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500">
              <span>{query.data.pagination.total} registros</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= query.data.pagination.totalPages}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      <Modal open={open} title="Novo veículo" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label
              className="mb-1 block text-sm font-semibold"
              htmlFor="vehicle-customer"
            >
              Cliente
            </label>
            <Select
              id="vehicle-customer"
              required
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              <option value="">Selecione</option>
              {customers.data?.data.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="vehicle-plate"
              >
                Placa
              </label>
              <Input
                id="vehicle-plate"
                maxLength={12}
                value={form.plate}
                onChange={(e) => setForm({ ...form, plate: e.target.value })}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="vehicle-brand"
              >
                Marca
              </label>
              <Input
                id="vehicle-brand"
                required
                maxLength={80}
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-semibold"
              htmlFor="vehicle-model"
            >
              Modelo
            </label>
            <Input
              id="vehicle-model"
              required
              maxLength={120}
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="vehicle-year"
              >
                Ano modelo
              </label>
              <Input
                id="vehicle-year"
                type="number"
                min={1886}
                max={new Date().getFullYear() + 2}
                value={form.yearModel || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    yearModel: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="vehicle-mileage"
              >
                Quilometragem
              </label>
              <Input
                id="vehicle-mileage"
                type="number"
                min={0}
                value={form.currentMileage ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currentMileage: e.target.value
                      ? Number(e.target.value)
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
              {create.isPending ? "Salvando..." : "Salvar veículo"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
