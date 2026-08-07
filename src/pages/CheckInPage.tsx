import { AlertTriangle, Car, CheckCircle2, Gauge, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  workshopApi,
  type CheckInWorkspace,
  type DamageLocation,
  type ObservationStatus,
} from "../services/workshop";

const statusLabels: Record<ObservationStatus, string> = {
  OK: "OK",
  ISSUE: "Anormalidade",
  NOT_CHECKED: "Não verificado",
  NOT_APPLICABLE: "Não aplicável",
};
const mapAreas: Array<[DamageLocation, string]> = [
  ["FRONT_BUMPER", "Frente"],
  ["HOOD", "Capô"],
  ["ROOF", "Teto"],
  ["FRONT_LEFT_DOOR", "Porta diant. esq."],
  ["FRONT_RIGHT_DOOR", "Porta diant. dir."],
  ["REAR_LEFT_DOOR", "Porta tras. esq."],
  ["REAR_RIGHT_DOOR", "Porta tras. dir."],
  ["TRUNK_LID", "Tampa traseira"],
  ["REAR_BUMPER", "Traseira"],
];

export function CheckInPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<CheckInWorkspace | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [damageLocation, setDamageLocation] = useState<DamageLocation | null>(
    null,
  );
  const [damageType, setDamageType] = useState("SCRATCH");
  const [severity, setSeverity] = useState("MINOR");
  const [description, setDescription] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await workshopApi.getCheckIn(id));
      setError("");
    } catch (cause) {
      setError(
        getPublicErrorMessage(cause, "Não foi possível carregar o Check-in."),
      );
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const items = useMemo(
    () =>
      data?.checkIn.checklistInstance.template.sections.flatMap(
        (section) => section.items,
      ) ?? [],
    [data],
  );
  const answered = data?.checkIn.checklistInstance.results.length ?? 0;
  const readonly = data?.checkIn.status !== "DRAFT";
  const canUpdate = hasPermission(user, "checkins.update") && !readonly;
  const setStatus = async (itemId: string, status: ObservationStatus) => {
    if (!canUpdate) return;
    setSaving(true);
    try {
      await workshopApi.saveResult(id, itemId, { status });
      await load();
    } catch (cause) {
      setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  const saveResult = async (
    itemId: string,
    input: Parameters<typeof workshopApi.saveResult>[2],
  ) => {
    if (!canUpdate) return;
    setSaving(true);
    try {
      await workshopApi.saveResult(id, itemId, input);
      await load();
    } catch (cause) {
      setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  const saveDraft = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await workshopApi.updateCheckIn(id, {
        mileage: data.checkIn.mileage ?? undefined,
        fuelLevel: data.checkIn.fuelLevel ?? undefined,
        generalNotes: data.checkIn.generalNotes,
      });
      await load();
    } catch (cause) {
      setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  const addDamage = async () => {
    if (!damageLocation) return;
    setSaving(true);
    try {
      await workshopApi.createDamage(id, {
        location: damageLocation,
        damageType,
        severity,
        description: description || null,
      });
      setDamageLocation(null);
      setDescription("");
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
      await workshopApi.completeCheckIn(id);
      await load();
    } catch (cause) {
      setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  if (!data)
    return <Card className="p-6">{error || "Carregando Check-in..."}</Card>;
  const resultFor = (itemId: string) =>
    data.checkIn.checklistInstance.results.find(
      (result) => result.itemId === itemId,
    );
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Check-in · OS #${data.workOrder.number}`}
        description={`${data.workOrder.customer.name} · ${data.workOrder.vehicle.brand} ${data.workOrder.vehicle.model} · ${data.workOrder.vehicle.plate ?? "Sem placa"}`}
        action={
          <Link to={`/ordens-servico/${id}/pdc`}>
            <Button variant="secondary">Ir para o PDC</Button>
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="size-4" /> Quilometragem
          </div>
          <Input
            type="number"
            value={data.checkIn.mileage ?? ""}
            disabled={!canUpdate}
            onChange={(event) =>
              setData({
                ...data,
                checkIn: {
                  ...data.checkIn,
                  mileage: event.target.value
                    ? Number(event.target.value)
                    : null,
                },
              })
            }
          />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Car className="size-4" /> Combustível
          </div>
          <Select
            value={data.checkIn.fuelLevel ?? ""}
            disabled={!canUpdate}
            onChange={(event) =>
              setData({
                ...data,
                checkIn: {
                  ...data.checkIn,
                  fuelLevel: Number(event.target.value),
                },
              })
            }
          >
            <option value="">Selecione</option>
            {[0, 25, 50, 75, 100].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </Select>
        </Card>
        <Card className="p-4">
          <div className="flex justify-between">
            <span className="text-sm font-semibold">Progresso</span>
            <Badge tone={answered === items.length ? "success" : "info"}>
              {answered}/{items.length}
            </Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full bg-brand-500"
              style={{
                width: `${items.length ? (answered / items.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Ausência de resposta nunca significa OK.
          </p>
        </Card>
      </div>
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <MapPin className="size-5" /> Mapa de avarias
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Selecione uma área do veículo para registrar a condição observada na
          entrada.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {mapAreas.map(([location, label]) => (
            <Button
              key={location}
              variant="secondary"
              disabled={!canUpdate}
              onClick={() => setDamageLocation(location)}
              className="h-auto min-h-12 whitespace-normal"
            >
              {label}
            </Button>
          ))}
        </div>
        {data.checkIn.damages.length > 0 && (
          <div className="mt-4 space-y-2">
            {data.checkIn.damages.map((damage) => (
              <div
                key={damage.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span>
                  {mapAreas.find(([value]) => value === damage.location)?.[1] ??
                    damage.location}{" "}
                  · {damage.damageType}
                </span>
                <Badge
                  tone={damage.severity === "SEVERE" ? "danger" : "warning"}
                >
                  {damage.severity === "MINOR"
                    ? "Leve"
                    : damage.severity === "MODERATE"
                      ? "Moderada"
                      : "Grave"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
      {data.checkIn.checklistInstance.template.sections.map((section) => (
        <Card key={section.id} className="overflow-hidden">
          <details open>
            <summary className="cursor-pointer border-b px-5 py-4 font-bold">
              {section.title}
            </summary>
            <div className="divide-y">
              {section.items.map((item) => {
                const result = resultFor(item.id);
                return (
                  <div key={item.id} className="p-4">
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                      <div>
                        <p className="font-medium text-slate-800">
                          {item.title}
                          {item.isRequired && (
                            <span className="text-red-600"> *</span>
                          )}
                        </p>
                        {result?.note && (
                          <p className="text-xs text-slate-500">
                            {result.note}
                          </p>
                        )}
                      </div>
                      {item.responseType === "STATUS" ? (
                        <div className="w-full space-y-2 lg:max-w-2xl">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {(
                              Object.keys(statusLabels) as ObservationStatus[]
                            ).map((status) => (
                              <Button
                                key={status}
                                disabled={!canUpdate || saving}
                                variant={
                                  result?.status === status
                                    ? "primary"
                                    : "secondary"
                                }
                                onClick={() => setStatus(item.id, status)}
                              >
                                {status === "ISSUE" && (
                                  <AlertTriangle className="size-4" />
                                )}
                                {statusLabels[status]}
                              </Button>
                            ))}
                          </div>
                          {result?.status === "ISSUE" && (
                            <Textarea
                              aria-label={`Observação de ${item.title}`}
                              key={`${item.id}-${result.note ?? ""}`}
                              defaultValue={result.note ?? ""}
                              disabled={!canUpdate || saving}
                              placeholder="Descreva a anormalidade observada"
                              onBlur={(event) =>
                                void saveResult(item.id, {
                                  status: "ISSUE",
                                  note: event.target.value || null,
                                })
                              }
                            />
                          )}
                        </div>
                      ) : item.responseType === "TEXT" ? (
                        <Textarea
                          aria-label={item.title}
                          key={`${item.id}-${result?.textValue ?? ""}`}
                          defaultValue={result?.textValue ?? ""}
                          disabled={!canUpdate || saving}
                          onBlur={(event) =>
                            void saveResult(item.id, {
                              textValue: event.target.value,
                            })
                          }
                          className="w-full lg:max-w-xl"
                        />
                      ) : item.responseType === "NUMBER" ? (
                        <Input
                          aria-label={item.title}
                          key={`${item.id}-${result?.numericValue ?? ""}`}
                          type="number"
                          defaultValue={result?.numericValue ?? ""}
                          disabled={!canUpdate || saving}
                          onBlur={(event) => {
                            if (event.target.value !== "") {
                              void saveResult(item.id, {
                                numericValue: Number(event.target.value),
                              });
                            }
                          }}
                          className="w-full lg:max-w-xs"
                        />
                      ) : (
                        <Select
                          aria-label={item.title}
                          value={result?.selectedValue ?? ""}
                          disabled={!canUpdate || saving}
                          onChange={(event) =>
                            void saveResult(item.id, {
                              selectedValue: event.target.value,
                            })
                          }
                          className="w-full lg:max-w-xs"
                        >
                          <option value="">Selecione</option>
                          {(item.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        </Card>
      ))}
      <Card className="p-5">
        <label className="text-sm font-semibold">Observações gerais</label>
        <Textarea
          disabled={!canUpdate}
          value={data.checkIn.generalNotes ?? ""}
          onChange={(event) =>
            setData({
              ...data,
              checkIn: { ...data.checkIn, generalNotes: event.target.value },
            })
          }
        />
      </Card>
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-canvas/95 py-3">
        <Button
          variant="secondary"
          disabled={!canUpdate || saving}
          onClick={saveDraft}
        >
          Salvar rascunho
        </Button>
        <Button
          disabled={
            readonly || saving || !hasPermission(user, "checkins.complete")
          }
          onClick={complete}
        >
          <CheckCircle2 className="size-4" />
          Concluir Check-in
        </Button>
      </div>
      <Modal
        open={damageLocation !== null}
        title="Registrar avaria"
        onClose={() => setDamageLocation(null)}
      >
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            Tipo de avaria
            <Select
              value={damageType}
              onChange={(event) => setDamageType(event.target.value)}
            >
              {[
                ["SCRATCH", "Risco"],
                ["SCUFF", "Ralado"],
                ["DENT", "Amassado"],
                ["CRACK", "Trincado"],
                ["BROKEN", "Quebrado"],
                ["MISSING", "Ausente"],
                ["WORN", "Desgastado"],
                ["DAMAGED", "Danificado"],
                ["OTHER", "Outro"],
              ].map(([value, label]) => (
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
              onChange={(event) => setSeverity(event.target.value)}
            >
              <option value="MINOR">Leve</option>
              <option value="MODERATE">Moderada</option>
              <option value="SEVERE">Grave</option>
            </Select>
          </label>
          <label className="block text-sm font-semibold">
            Observação
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDamageLocation(null)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={addDamage}>
              Registrar avaria
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
