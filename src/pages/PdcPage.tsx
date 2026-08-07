import { AlertOctagon, CheckCircle2, Plus, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../lib/permissions";
import { getPublicErrorMessage } from "../services/api";
import { workshopApi, type PdcWorkspace } from "../services/workshop";

const categoryLabels: Record<string, string> = {
  BRAKES: "Freios",
  SUSPENSION: "Suspensão",
  STEERING: "Direção",
  ENGINE: "Motor",
  TRANSMISSION: "Transmissão",
  ELECTRICAL: "Elétrica",
  BATTERY: "Bateria",
  TIRES: "Pneus",
  AIR_CONDITIONING: "Ar-condicionado",
  FLUIDS: "Fluidos",
  BODY: "Carroceria",
  INTERIOR: "Interior",
  SAFETY: "Segurança",
  OTHER: "Outro",
};
const severityLabels = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
} as const;

export function PdcPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const canUpdate = hasPermission(user, "pdc.update");
  const [data, setData] = useState<PdcWorkspace | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [category, setCategory] = useState("BRAKES");
  const [severity, setSeverity] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  >("MEDIUM");
  const [description, setDescription] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [immediate, setImmediate] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await workshopApi.getPdc(id));
      setError("");
    } catch (cause) {
      setError(
        getPublicErrorMessage(cause, "Não foi possível carregar o PDC."),
      );
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const start = async () => {
    setSaving(true);
    try {
      await workshopApi.createPdc(id, {
        mileage: data?.checkIn?.mileage ?? undefined,
      });
      await load();
    } catch (cause) {
      setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  const addFinding = async () => {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await workshopApi.addFinding(id, {
        category,
        severity,
        status: "ISSUE",
        description,
        recommendation: recommendation || null,
        requiresImmediateAttention: immediate,
      });
      setModal(false);
      setDescription("");
      setRecommendation("");
      setImmediate(false);
      await load();
    } catch (cause) {
      setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  const save = async () => {
    if (!data?.pdc) return;
    setSaving(true);
    try {
      await workshopApi.updatePdc(id, {
        mileage: data.pdc.mileage ?? undefined,
        generalNotes: data.pdc.generalNotes,
      });
      await load();
    } catch (cause) {
      setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  const complete = async () => {
    setSaving(true);
    try {
      await workshopApi.completePdc(id);
      await load();
    } catch (cause) {
      setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  if (!data) return <Card className="p-6">{error || "Carregando PDC..."}</Card>;
  const readonly = data.pdc?.status === "COMPLETED";
  return (
    <div className="space-y-5">
      <PageHeader
        title={`PDC — Primeiro Diagnóstico do Carro · OS #${data.workOrder.number}`}
        description={`${data.workOrder.customer.name} · ${data.workOrder.vehicle.brand} ${data.workOrder.vehicle.model} · ${data.workOrder.vehicle.plate ?? "Sem placa"}`}
        action={
          <Link to={`/ordens-servico/${id}/check-in`}>
            <Button variant="secondary">Voltar ao Check-in</Button>
          </Link>
        }
      />
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold">Relato do cliente</h2>
          <p className="mt-1 text-xs text-slate-500">
            Referência somente leitura. O PDC não altera o relato original.
          </p>
          <div className="mt-3 space-y-2">
            {data.concerns.map((concern) => (
              <p
                key={concern.id}
                className="rounded-md bg-slate-50 p-3 text-sm"
              >
                {concern.sequence}. {concern.description}
              </p>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold">Resumo do Check-in</h2>
          {data.checkIn ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                tone={
                  data.checkIn.status === "COMPLETED" ? "success" : "warning"
                }
              >
                {data.checkIn.status === "COMPLETED"
                  ? "Concluído"
                  : "Em rascunho"}
              </Badge>
              <Badge tone="info">{data.checkIn.mileage ?? "—"} km</Badge>
              <Badge tone={data.checkIn.damages.length ? "warning" : "success"}>
                {data.checkIn.damages.length} avaria(s)
              </Badge>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Check-in não encontrado.
            </p>
          )}
        </Card>
      </div>
      {!data.pdc ? (
        <Card className="p-8 text-center">
          <Wrench className="mx-auto size-10 text-brand-600" />
          <h2 className="mt-3 font-bold">Iniciar avaliação técnica inicial</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
            O PDC registra hipóteses e recomendações iniciais sem substituir o
            diagnóstico técnico definitivo.
          </p>
          <Button
            className="mt-4"
            disabled={
              saving ||
              data.checkIn?.status !== "COMPLETED" ||
              !hasPermission(user, "pdc.create")
            }
            onClick={start}
          >
            Iniciar PDC
          </Button>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-semibold">
                Quilometragem
                <Input
                  type="number"
                  disabled={readonly || !canUpdate}
                  value={data.pdc.mileage ?? ""}
                  onChange={(event) =>
                    setData({
                      ...data,
                      pdc: {
                        ...data.pdc!,
                        mileage: event.target.value
                          ? Number(event.target.value)
                          : null,
                      },
                    })
                  }
                />
              </label>
              <div className="text-sm">
                <span className="font-semibold">Técnico</span>
                <p className="mt-3">{data.pdc.technician.name}</p>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Estado</span>
                <p className="mt-3">
                  <Badge tone={readonly ? "success" : "info"}>
                    {readonly ? "Concluído" : "Rascunho"}
                  </Badge>
                </p>
              </div>
            </div>
            <label className="mt-4 block text-sm font-semibold">
              Observações gerais
              <Textarea
                disabled={readonly || !canUpdate}
                value={data.pdc.generalNotes ?? ""}
                onChange={(event) =>
                  setData({
                    ...data,
                    pdc: { ...data.pdc!, generalNotes: event.target.value },
                  })
                }
              />
            </label>
          </Card>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="font-bold">Achados do PDC</h2>
                <p className="text-sm text-slate-500">
                  Avaliações técnicas iniciais; não geram orçamento
                  automaticamente.
                </p>
              </div>
              <Button
                disabled={readonly || saving || !canUpdate}
                onClick={() => setModal(true)}
              >
                <Plus className="size-4" />
                Adicionar achado
              </Button>
            </div>
            <div className="divide-y">
              {data.pdc.findings.length ? (
                data.pdc.findings.map((finding) => (
                  <article key={finding.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          finding.severity === "CRITICAL"
                            ? "danger"
                            : finding.severity === "HIGH"
                              ? "warning"
                              : "info"
                        }
                      >
                        {severityLabels[finding.severity]}
                      </Badge>
                      <strong>
                        {categoryLabels[finding.category] ?? finding.category}
                      </strong>
                      {finding.requiresImmediateAttention && (
                        <Badge tone="danger">
                          <AlertOctagon className="mr-1 size-3" />
                          Atenção imediata
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {finding.description}
                    </p>
                    {finding.recommendation && (
                      <p className="mt-2 text-sm">
                        <strong>Recomendação:</strong> {finding.recommendation}
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <p className="p-8 text-center text-sm text-slate-500">
                  Nenhum achado registrado.
                </p>
              )}
            </div>
          </Card>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-canvas/95 py-3">
            <Button
              variant="secondary"
              disabled={
                readonly || saving || !canUpdate
              }
              onClick={save}
            >
              Salvar rascunho
            </Button>
            <Button
              disabled={
                readonly || saving || !hasPermission(user, "pdc.complete")
              }
              onClick={complete}
            >
              <CheckCircle2 className="size-4" />
              Concluir PDC
            </Button>
          </div>
        </>
      )}
      <Modal
        open={modal}
        title="Adicionar achado do PDC"
        onClose={() => setModal(false)}
      >
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            Categoria
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-semibold">
            Severidade
            <Select
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as typeof severity)
              }
            >
              {Object.entries(severityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-semibold">
            Descrição
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Recomendação
            <Textarea
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={immediate}
              onChange={(event) => setImmediate(event.target.checked)}
            />{" "}
            Exige atenção imediata
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!description.trim() || saving}
              onClick={addFinding}
            >
              Adicionar achado
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
