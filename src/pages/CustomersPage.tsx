import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
  customersApi,
  type CustomerInput,
  type CustomerStatus,
  type CustomerType,
} from "../services/customers";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../lib/permissions";
import { customerTypeLabels, statusLabels } from "../i18n/pt-BR";
import { formatDocument, formatPhone } from "../i18n/formatters";

const emptyForm: CustomerInput = {
  name: "",
  type: "INDIVIDUAL",
  document: "",
  email: "",
  phone: "",
  whatsapp: "",
};

export function CustomersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [type, setType] = useState<CustomerType | "">("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["customers", page, search, status, type],
    queryFn: () =>
      customersApi.list({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
        type: type || undefined,
      }),
  });
  const create = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: () =>
      setError(
        "Não foi possível cadastrar o cliente. Verifique os dados informados.",
      ),
  });
  const remove = useMutation({
    mutationFn: customersApi.remove,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    create.mutate(form);
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Cadastros e contatos da empresa"
        action={
          hasPermission(user, "customers.create") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Novo cliente
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
            aria-label="Pesquisar clientes"
            placeholder="Pesquisar por nome, CPF/CNPJ ou contato..."
          />
          <Select
            aria-label="Filtrar por status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as CustomerStatus | "");
              setPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Inativos</option>
            <option value="BLOCKED">Bloqueados</option>
          </Select>
          <Select
            aria-label="Filtrar por tipo"
            value={type}
            onChange={(e) => {
              setType(e.target.value as CustomerType | "");
              setPage(1);
            }}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(customerTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Carregando clientes...
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Não foi possível carregar os clientes."
            description="Tente novamente em alguns instantes."
          />
        ) : !query.data?.data.length ? (
          <EmptyState
            title="Nenhum cliente encontrado."
            description="Não encontramos resultados para os filtros informados."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">CPF/CNPJ</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">WhatsApp</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Filial de origem</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {query.data.data.map((customer) => (
                    <tr key={customer.id} className="h-16">
                      <td className="px-4">
                        <p className="font-semibold text-ink">
                          {customer.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {customer.email || customer.tradeName || "Sem e-mail"}
                        </p>
                      </td>
                      <td className="px-4">
                        {formatDocument(customer.document)}
                      </td>
                      <td className="px-4">{formatPhone(customer.phone)}</td>
                      <td className="px-4">{formatPhone(customer.whatsapp)}</td>
                      <td className="px-4">
                        <Badge
                          tone={
                            customer.status === "ACTIVE"
                              ? "success"
                              : customer.status === "BLOCKED"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {statusLabels[customer.status]}
                        </Badge>
                      </td>
                      <td className="px-4">
                        {customer.originBranch?.name || "Todas as filiais"}
                      </td>
                      <td className="px-4 text-right">
                        {hasPermission(user, "customers.delete") && (
                          <IconButton
                            label={`Excluir ${customer.name}`}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Excluir cliente ${customer.name}? Os registros históricos relacionados serão preservados.`,
                                )
                              )
                                remove.mutate(customer.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        )}
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
                  onClick={() => setPage((value) => value - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= query.data.pagination.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      <Modal open={open} title="Novo cliente" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label
              className="mb-1 block text-sm font-semibold"
              htmlFor="customer-name"
            >
              Nome
            </label>
            <Input
              id="customer-name"
              required
              maxLength={180}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="customer-type"
              >
                Tipo
              </label>
              <Select
                id="customer-type"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as CustomerType })
                }
              >
                {Object.entries(customerTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="customer-document"
              >
                CPF/CNPJ
              </label>
              <Input
                id="customer-document"
                maxLength={18}
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-semibold"
              htmlFor="customer-email"
            >
              E-mail
            </label>
            <Input
              id="customer-email"
              type="email"
              maxLength={180}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="customer-phone"
              >
                Telefone
              </label>
              <Input
                id="customer-phone"
                maxLength={20}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-semibold"
                htmlFor="customer-whatsapp"
              >
                WhatsApp
              </label>
              <Input
                id="customer-whatsapp"
                maxLength={20}
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
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
              {create.isPending ? "Salvando..." : "Salvar cliente"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
