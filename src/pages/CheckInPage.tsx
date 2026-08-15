import { AlertTriangle, Camera, Car, CheckCircle2, Gauge, MapPin } from "lucide-react";
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
import { VehicleDamageMap } from "../components/VehicleDamageMap";
import {
  PhotoEvidenceGallery,
  PhotoEvidenceUploader,
} from "../components/PhotoEvidence";
import { useAuth } from "../hooks/useAuth";
import { checkInEvidenceCategoryLabels } from "../i18n/pt-BR";
import { hasPermission } from "../lib/permissions";
import { getApiErrorCode, getApiErrorDetails, getApiStatus, getPublicErrorMessage } from "../services/api";
import {
  workshopApi,
  type ChecklistItem,
  type ChecklistResult,
  type CheckInWorkspace,
  type DamageLocation,
  type ObservationStatus,
} from "../services/workshop";
import {
  photoEvidenceApi,
  type CheckInEvidenceCategory,
  type PhotoEvidence,
} from "../services/photoEvidence";

const statusLabels: Record<ObservationStatus, string> = {
  OK: "OK",
  ISSUE: "Anormalidade",
  NOT_CHECKED: "Não verificado",
  NOT_APPLICABLE: "Não aplicável",
};
const locationLabels: Record<DamageLocation, string> = {
  FRONT_BUMPER: "Para-choque dianteiro",
  REAR_BUMPER: "Para-choque traseiro",
  HOOD: "Capô",
  ROOF: "Teto",
  TRUNK_LID: "Tampa traseira",
  FRONT_LEFT_FENDER: "Para-lama dianteiro esquerdo",
  FRONT_RIGHT_FENDER: "Para-lama dianteiro direito",
  REAR_LEFT_QUARTER: "Lateral traseira esquerda",
  REAR_RIGHT_QUARTER: "Lateral traseira direita",
  FRONT_LEFT_DOOR: "Porta dianteira esquerda",
  FRONT_RIGHT_DOOR: "Porta dianteira direita",
  REAR_LEFT_DOOR: "Porta traseira esquerda",
  REAR_RIGHT_DOOR: "Porta traseira direita",
  LEFT_MIRROR: "Retrovisor esquerdo",
  RIGHT_MIRROR: "Retrovisor direito",
  WINDSHIELD: "Para-brisa",
  REAR_GLASS: "Vidro traseiro",
  LEFT_FRONT_GLASS: "Vidro dianteiro esquerdo",
  RIGHT_FRONT_GLASS: "Vidro dianteiro direito",
  LEFT_REAR_GLASS: "Vidro traseiro esquerdo",
  RIGHT_REAR_GLASS: "Vidro traseiro direito",
  FRONT_LEFT_WHEEL: "Roda dianteira esquerda",
  FRONT_RIGHT_WHEEL: "Roda dianteira direita",
  REAR_LEFT_WHEEL: "Roda traseira esquerda",
  REAR_RIGHT_WHEEL: "Roda traseira direita",
  INTERIOR: "Interior",
  DASHBOARD: "Painel",
  TRUNK: "Porta-malas",
  OTHER: "Outra área",
};
const damageTypeLabels: Record<string, string> = {
  SCRATCH: "Risco",
  SCUFF: "Ralado",
  DENT: "Amassado",
  CRACK: "Trinca",
  BROKEN: "Quebrado",
  MISSING: "Ausente",
  WORN: "Desgastado",
  STAIN: "Mancha",
  CHIPPED: "Lascado",
  DAMAGED: "Danificado",
  OTHER: "Outro",
};

export function CheckInPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<CheckInWorkspace | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [damageLocation, setDamageLocation] = useState<DamageLocation | null>(null);
  const [damageType, setDamageType] = useState("SCRATCH");
  const [severity, setSeverity] = useState("MINOR");
  const [description, setDescription] = useState("");
  const [generalEvidence, setGeneralEvidence] = useState<PhotoEvidence[]>([]);
  const [generalEvidenceError, setGeneralEvidenceError] = useState("");
  const [generalCategory, setGeneralCategory] =
    useState<CheckInEvidenceCategory>("FRONT");
  const [selectedDamage, setSelectedDamage] = useState<
    CheckInWorkspace["checkIn"]["damages"][number] | null
  >(null);
  const [damageEvidence, setDamageEvidence] = useState<PhotoEvidence[]>([]);
  const [damageEvidenceError, setDamageEvidenceError] = useState("");
  const [damageEvidenceCounts, setDamageEvidenceCounts] = useState<
    Record<string, number>
  >({});
  const [selectedChecklistItem, setSelectedChecklistItem] = useState<{
    item: ChecklistItem;
    result: ChecklistResult;
  } | null>(null);
  const [checklistItemEvidence, setChecklistItemEvidence] = useState<PhotoEvidence[]>([]);
  const [checklistEvidenceCounts, setChecklistEvidenceCounts] = useState<Record<string, number>>({});
  const [checklistEvidenceError, setChecklistEvidenceError] = useState("");
  const [photoPendingItemIds, setPhotoPendingItemIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setData(await workshopApi.getCheckIn(id));
      setError("");
    } catch (cause) {
      if (getApiStatus(cause) === 404 && hasPermission(user, "checkins.create")) {
        try {
          await workshopApi.createCheckIn(id);
          setData(await workshopApi.getCheckIn(id));
          setError("");
          return;
        } catch (createCause) {
          setError(
            getPublicErrorMessage(createCause, "Não foi possível iniciar o Check-in."),
          );
          return;
        }
      }
      setError(getPublicErrorMessage(cause, "Não foi possível carregar o Check-in."));
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadGeneralEvidence = useCallback(async () => {
    try {
      setGeneralEvidence(await photoEvidenceApi.listCheckIn(id));
      setGeneralEvidenceError("");
    } catch (cause) {
      setGeneralEvidenceError(
        getPublicErrorMessage(cause, "Não foi possível carregar as fotos da vistoria."),
      );
    }
  }, [id]);

  useEffect(() => {
    void loadGeneralEvidence();
  }, [loadGeneralEvidence]);

  useEffect(() => {
    if (!data?.checkIn.damages.length) {
      setDamageEvidenceCounts({});
      return;
    }
    let active = true;
    void Promise.all(
      data.checkIn.damages.map(async (damage) => [
        damage.id,
        (await photoEvidenceApi.listDamage(id, damage.id)).length,
      ] as const),
    ).then((entries) => {
      if (active) setDamageEvidenceCounts(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [data?.checkIn.damages, id]);

  useEffect(() => {
    const results = data?.checkIn.checklistInstance.results ?? [];
    if (!results.length) {
      setChecklistEvidenceCounts({});
      return;
    }
    let active = true;
    void Promise.all(results.map(async (result) => [
      result.id,
      (await photoEvidenceApi.listChecklistItem(id, result.id)).length,
    ] as const)).then((entries) => {
      if (active) setChecklistEvidenceCounts(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [data?.checkIn.checklistInstance.results, id]);

  const openChecklistItemEvidence = async (item: ChecklistItem, result: ChecklistResult) => {
    setSelectedChecklistItem({ item, result });
    setChecklistItemEvidence([]);
    setChecklistEvidenceError("");
    try {
      setChecklistItemEvidence(await photoEvidenceApi.listChecklistItem(id, result.id));
    } catch (cause) {
      setChecklistEvidenceError(getPublicErrorMessage(cause, "Não foi possível carregar as fotos do item."));
    }
  };

  const openDamageEvidence = async (
    damage: CheckInWorkspace["checkIn"]["damages"][number],
  ) => {
    setSelectedDamage(damage);
    setDamageEvidence([]);
    setDamageEvidenceError("");
    try {
      setDamageEvidence(await photoEvidenceApi.listDamage(id, damage.id));
    } catch (cause) {
      setDamageEvidenceError(
        getPublicErrorMessage(cause, "Não foi possível carregar as fotos da avaria."),
      );
    }
  };

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
      const damage = await workshopApi.createDamage(id, {
        location: damageLocation,
        damageType,
        severity,
        description: description || null,
      });
      setDamageLocation(null);
      setDescription("");
      await load();
      await openDamageEvidence(damage);
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
      if (getApiErrorCode(cause) === "CHECKLIST_PHOTO_REQUIRED") {
        const details = getApiErrorDetails(cause) as { items?: Array<{ itemId?: string }> } | undefined;
        const pending = details?.items?.flatMap(({ itemId }) => itemId ? [itemId] : []) ?? [];
        setPhotoPendingItemIds(pending);
        setError(
          pending.length === 1
            ? "Não é possível concluir o Check-in. Existe 1 item que exige foto."
            : `Não é possível concluir o Check-in. Existem ${pending.length} itens que exigem foto.`,
        );
        requestAnimationFrame(() => document.getElementById(`checklist-item-${pending[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } else setError(getPublicErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <Card className="p-6">{error || "Carregando Check-in..."}</Card>;

  const resultFor = (itemId: string) =>
    data.checkIn.checklistInstance.results.find((result) => result.itemId === itemId);

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
                  mileage: event.target.value ? Number(event.target.value) : null,
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
          <Camera className="size-5" /> Fotos da vistoria
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Registre imagens privadas do estado do veículo durante o Check-in.
        </p>
        {canUpdate && (
          <div className="mt-4">
            <PhotoEvidenceUploader
              onUpload={(file, caption) =>
                photoEvidenceApi.uploadCheckIn(id, {
                  file,
                  caption,
                  category: generalCategory,
                })
              }
              onUploaded={(evidence) =>
                setGeneralEvidence((current) => [...current, evidence])
              }
            >
              <label className="block text-sm font-semibold text-slate-800">
                Categoria
                <Select
                  aria-label="Categoria da foto"
                  value={generalCategory}
                  onChange={(event) =>
                    setGeneralCategory(event.target.value as CheckInEvidenceCategory)
                  }
                >
                  {Object.entries(checkInEvidenceCategoryLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ),
                  )}
                </Select>
              </label>
            </PhotoEvidenceUploader>
          </div>
        )}
        {generalEvidenceError && (
          <p role="alert" className="mt-3 text-sm text-red-700">{generalEvidenceError}</p>
        )}
        <div className="mt-4">
          <PhotoEvidenceGallery
            evidence={generalEvidence}
            readonly={!canUpdate}
            contextLabel={(item) =>
              checkInEvidenceCategoryLabels[item.category ?? "OTHER"]
            }
            loadContent={(evidenceId) =>
              photoEvidenceApi.getCheckInContent(id, evidenceId)
            }
            onDelete={async (evidenceId) => {
              await photoEvidenceApi.deleteCheckIn(id, evidenceId);
              setGeneralEvidence((current) =>
                current.filter(({ id: currentId }) => currentId !== evidenceId),
              );
            }}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <MapPin className="size-5" /> Mapa de avarias
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Toque diretamente na região do veículo para registrar uma avaria. Áreas com
          ocorrências ficam destacadas e exibem a quantidade registrada.
        </p>
        <VehicleDamageMap
          damages={data.checkIn.damages}
          disabled={!canUpdate}
          locationLabels={locationLabels}
          onSelect={setDamageLocation}
        />
        {data.checkIn.damages.length > 0 && (
          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-800">Avarias registradas</h3>
            {data.checkIn.damages.map((damage) => (
              <div
                key={damage.id}
                className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  {locationLabels[damage.location]} · {damageTypeLabels[damage.damageType] ?? "Outro"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={damage.severity === "SEVERE" ? "danger" : "warning"}>
                    {damage.severity === "MINOR"
                      ? "Leve"
                      : damage.severity === "MODERATE"
                        ? "Moderada"
                        : "Grave"}
                  </Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void openDamageEvidence(damage)}
                  >
                    <Camera className="size-4" />
                    Fotos ({damageEvidenceCounts[damage.id] ?? 0})
                  </Button>
                </div>
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
                  <div id={`checklist-item-${item.id}`} key={item.id} className={`p-4 ${photoPendingItemIds.includes(item.id) ? "border-l-4 border-amber-500 bg-amber-50" : ""}`}>
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                      <div>
                        <p className="font-medium text-slate-800">
                          {item.title}
                          {item.isRequired && <span className="text-red-600"> *</span>}
                        </p>
                        {result?.note && (
                          <p className="text-xs text-slate-500">{result.note}</p>
                        )}
                      </div>

                      {item.responseType === "STATUS" ? (
                        <div className="w-full space-y-2 lg:max-w-2xl">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {(Object.keys(statusLabels) as ObservationStatus[]).map(
                              (status) => (
                                <Button
                                  key={status}
                                  disabled={!canUpdate || saving}
                                  variant={result?.status === status ? "primary" : "secondary"}
                                  onClick={() => setStatus(item.id, status)}
                                >
                                  {status === "ISSUE" && (
                                    <AlertTriangle className="size-4" />
                                  )}
                                  {statusLabels[status]}
                                </Button>
                              ),
                            )}
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

                      {(item.requiresPhoto || item.photoRequiredOnIssue) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:mt-0">
                          <Badge tone={item.requiresPhoto ? "warning" : "info"}>
                            {item.requiresPhoto ? "Foto obrigatória" : "Foto obrigatória se houver problema"}
                          </Badge>
                          {(() => {
                            const requiredNow = item.requiresPhoto || (item.photoRequiredOnIssue && result?.status === "ISSUE");
                            const count = result ? (checklistEvidenceCounts[result.id] ?? 0) : 0;
                            return requiredNow && count === 0 ? <Badge tone="danger">Foto pendente</Badge> : count > 0 ? <Badge tone="success">Evidência registrada</Badge> : null;
                          })()}
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!result}
                            title={!result ? "Responda ao item antes de adicionar fotos" : undefined}
                            onClick={() => result && void openChecklistItemEvidence(item, result)}
                          >
                            <Camera className="size-4" /> {result ? (checklistEvidenceCounts[result.id] ?? 0) : 0} fotos
                          </Button>
                        </div>
                      )}
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
          disabled={readonly || saving || !hasPermission(user, "checkins.complete")}
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
            Localização
            <Select
              value={damageLocation ?? ""}
              onChange={(event) =>
                setDamageLocation(event.target.value as DamageLocation)
              }
            >
              {Object.entries(locationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>

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
                ["STAIN", "Mancha"],
                ["CHIPPED", "Lascado"],
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

      <Modal
        open={selectedChecklistItem !== null}
        title={selectedChecklistItem ? `Fotos do item · ${selectedChecklistItem.item.title}` : "Fotos do item"}
        onClose={() => setSelectedChecklistItem(null)}
      >
        {selectedChecklistItem && (
          <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
            {canUpdate && (
              <PhotoEvidenceUploader
                onUpload={(file, caption) => photoEvidenceApi.uploadChecklistItem(id, selectedChecklistItem.result.id, { file, caption })}
                onUploaded={(evidence) => {
                  setChecklistItemEvidence((current) => [...current, evidence]);
                  setChecklistEvidenceCounts((current) => ({ ...current, [selectedChecklistItem.result.id]: (current[selectedChecklistItem.result.id] ?? 0) + 1 }));
                  setPhotoPendingItemIds((current) => current.filter((itemId) => itemId !== selectedChecklistItem.item.id));
                }}
              />
            )}
            {checklistEvidenceError && <p role="alert" className="text-sm text-red-700">{checklistEvidenceError}</p>}
            <PhotoEvidenceGallery
              evidence={checklistItemEvidence}
              readonly={!canUpdate}
              contextLabel={() => selectedChecklistItem.item.title}
              loadContent={(evidenceId) => photoEvidenceApi.getChecklistItemContent(id, selectedChecklistItem.result.id, evidenceId)}
              onDelete={async (evidenceId) => {
                await photoEvidenceApi.deleteChecklistItem(id, selectedChecklistItem.result.id, evidenceId);
                setChecklistItemEvidence((current) => current.filter(({ id: currentId }) => currentId !== evidenceId));
                setChecklistEvidenceCounts((current) => ({ ...current, [selectedChecklistItem.result.id]: Math.max(0, (current[selectedChecklistItem.result.id] ?? 1) - 1) }));
              }}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={selectedDamage !== null}
        title={
          selectedDamage
            ? `Fotos da avaria · ${locationLabels[selectedDamage.location]}`
            : "Fotos da avaria"
        }
        onClose={() => setSelectedDamage(null)}
      >
        {selectedDamage && (
          <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
            <p className="text-sm text-slate-600">
              {damageTypeLabels[selectedDamage.damageType] ?? "Avaria"}
              {selectedDamage.description ? ` · ${selectedDamage.description}` : ""}
            </p>
            {canUpdate && (
              <PhotoEvidenceUploader
                onUpload={(file, caption) =>
                  photoEvidenceApi.uploadDamage(id, selectedDamage.id, {
                    file,
                    caption,
                  })
                }
                onUploaded={(evidence) => {
                  setDamageEvidence((current) => [...current, evidence]);
                  setDamageEvidenceCounts((current) => ({
                    ...current,
                    [selectedDamage.id]: (current[selectedDamage.id] ?? 0) + 1,
                  }));
                }}
              />
            )}
            {damageEvidenceError && (
              <p role="alert" className="text-sm text-red-700">{damageEvidenceError}</p>
            )}
            <PhotoEvidenceGallery
              evidence={damageEvidence}
              readonly={!canUpdate}
              contextLabel={() => locationLabels[selectedDamage.location]}
              loadContent={(evidenceId) =>
                photoEvidenceApi.getDamageContent(
                  id,
                  selectedDamage.id,
                  evidenceId,
                )
              }
              onDelete={async (evidenceId) => {
                await photoEvidenceApi.deleteDamage(
                  id,
                  selectedDamage.id,
                  evidenceId,
                );
                setDamageEvidence((current) =>
                  current.filter(({ id: currentId }) => currentId !== evidenceId),
                );
                setDamageEvidenceCounts((current) => ({
                  ...current,
                  [selectedDamage.id]: Math.max(
                    0,
                    (current[selectedDamage.id] ?? 1) - 1,
                  ),
                }));
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
