import { Camera, ImageOff, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { getPublicErrorMessage } from "../services/api";
import type { PhotoEvidence } from "../services/photoEvidence";
import { Button, EmptyState, Input, Modal } from "./ui";

type UploadState = "aguardando" | "enviando" | "concluído" | "erro";
type UploadItem = {
  key: string;
  file: File;
  caption: string;
  previewUrl: string;
  state: UploadState;
  error: string;
};

export function PhotoEvidenceUploader({
  children,
  onUpload,
  onUploaded,
}: {
  children?: ReactNode;
  onUpload: (file: File, caption: string) => Promise<PhotoEvidence>;
  onUploaded: (evidence: PhotoEvidence) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => () => {
    for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
  }, []);

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files ?? [])];
    setItems((current) => [
      ...current,
      ...selected.map((file) => ({
        key: crypto.randomUUID(),
        file,
        caption: "",
        previewUrl: URL.createObjectURL(file),
        state: "aguardando" as const,
        error: "",
      })),
    ]);
    event.target.value = "";
  };

  const updateItem = (key: string, change: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  };

  const removeItem = (key: string) => {
    setItems((current) => {
      const item = current.find((candidate) => candidate.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((candidate) => candidate.key !== key);
    });
  };

  const upload = async (item: UploadItem) => {
    updateItem(item.key, { state: "enviando", error: "" });
    try {
      const evidence = await onUpload(item.file, item.caption);
      updateItem(item.key, { state: "concluído", error: "" });
      onUploaded(evidence);
    } catch (cause) {
      updateItem(item.key, {
        state: "erro",
        error: getPublicErrorMessage(
            cause,
            "Não foi possível enviar a foto. Verifique sua conexão e tente novamente.",
          ),
      });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
      {children}
      <label className="block text-sm font-semibold text-slate-800">
        Foto
        <Input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={choose}
          className="h-auto min-h-11 cursor-pointer py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold"
        />
      </label>
      {items.map((item) => (
        <div key={item.key} className="grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-[120px_minmax(0,1fr)]">
          <img
            src={item.previewUrl}
            alt={`Pré-visualização de ${item.file.name}`}
            className="h-28 w-full rounded-md border object-cover"
          />
          <div className="space-y-3">
            <Input
              aria-label={`Legenda de ${item.file.name}`}
              value={item.caption}
              maxLength={500}
              placeholder="Legenda opcional"
              disabled={item.state === "enviando" || item.state === "concluído"}
              onChange={(event) => updateItem(item.key, { caption: event.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              {item.state !== "concluído" && (
                <Button
                  type="button"
                  disabled={item.state === "enviando"}
                  onClick={() => void upload(item)}
                >
                  {item.state === "erro" ? <RefreshCw className="size-4" /> : <Upload className="size-4" />}
                  {item.state === "erro" ? "Tentar novamente" : item.state === "enviando" ? "Enviando..." : "Enviar foto"}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={item.state === "enviando"}
                onClick={() => removeItem(item.key)}
              >
                {item.state === "concluído" ? "Limpar" : "Remover seleção"}
              </Button>
            </div>
            <p className="text-xs text-slate-500" aria-live="polite">
              Estado de {item.file.name}: {item.state}.
            </p>
            {item.error && <p role="alert" className="text-sm text-red-700">{item.error}</p>}
          </div>
        </div>
      ))}
      {items.filter(({ state }) => state === "aguardando" || state === "erro").length > 1 && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            for (const item of items) {
              if (item.state === "aguardando" || item.state === "erro") void upload(item);
            }
          }}
        >
          Enviar fotos pendentes
        </Button>
      )}
    </div>
  );
}

type LoadedImage = { url?: string; loading: boolean; error?: string };

export function PhotoEvidenceGallery({
  evidence,
  readonly,
  contextLabel,
  loadContent,
  onDelete,
}: {
  evidence: PhotoEvidence[];
  readonly: boolean;
  contextLabel: (item: PhotoEvidence) => string;
  loadContent: (id: string) => Promise<Blob>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [images, setImages] = useState<Record<string, LoadedImage>>({});
  const [selected, setSelected] = useState<PhotoEvidence | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const urls = useRef(new Map<string, string>());
  const mounted = useRef(true);
  const activeEvidenceIds = useRef(new Set(evidence.map(({ id }) => id)));
  activeEvidenceIds.current = new Set(evidence.map(({ id }) => id));

  const load = useCallback(async (item: PhotoEvidence) => {
    setImages((current) => ({ ...current, [item.id]: { loading: true } }));
    try {
      const blob = await loadContent(item.id);
      if (!mounted.current || !activeEvidenceIds.current.has(item.id)) return;
      const previous = urls.current.get(item.id);
      if (previous) URL.revokeObjectURL(previous);
      const url = URL.createObjectURL(blob);
      urls.current.set(item.id, url);
      setImages((current) => ({ ...current, [item.id]: { loading: false, url } }));
    } catch (cause) {
      setImages((current) => ({
        ...current,
        [item.id]: {
          loading: false,
          error: getPublicErrorMessage(cause, "Não foi possível carregar esta foto."),
        },
      }));
    }
  }, [loadContent]);

  useEffect(() => {
    const activeIds = new Set(evidence.map(({ id }) => id));
    for (const [id, url] of urls.current) {
      if (!activeIds.has(id)) {
        URL.revokeObjectURL(url);
        urls.current.delete(id);
      }
    }
    for (const item of evidence) {
      if (!urls.current.has(item.id)) void load(item);
    }
  }, [evidence, load]);

  useEffect(() => () => {
    mounted.current = false;
    for (const url of urls.current.values()) URL.revokeObjectURL(url);
    urls.current.clear();
  }, []);

  const remove = async (item: PhotoEvidence) => {
    if (!window.confirm("Excluir esta foto? O registro deixará de aparecer na galeria.")) return;
    setDeleteError("");
    try {
      await onDelete(item.id);
      const url = urls.current.get(item.id);
      if (url) URL.revokeObjectURL(url);
      urls.current.delete(item.id);
      if (selected?.id === item.id) setSelected(null);
    } catch (cause) {
      setDeleteError(getPublicErrorMessage(cause, "Não foi possível excluir a foto."));
    }
  };

  if (!evidence.length)
    return <EmptyState title="Nenhuma foto adicionada" description="As fotos enviadas aparecerão aqui." />;

  return (
    <>
      {deleteError && <p role="alert" className="mb-3 text-sm text-red-700">{deleteError}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {evidence.map((item) => {
          const image = images[item.id];
          return (
            <article key={item.id} className="min-w-0 overflow-hidden rounded-lg border bg-white">
              <button
                type="button"
                className="flex aspect-square w-full items-center justify-center bg-slate-100"
                onClick={() => image?.url && setSelected(item)}
                aria-label={`Ampliar ${item.originalFilename}`}
              >
                {image?.url ? (
                  <img src={image.url} alt={item.caption || contextLabel(item)} className="size-full object-cover" />
                ) : image?.error ? (
                  <ImageOff className="size-8 text-slate-400" />
                ) : (
                  <Camera className="size-8 animate-pulse text-slate-400" />
                )}
              </button>
              <div className="space-y-1 p-2 text-xs">
                <p className="truncate font-semibold text-slate-700">{item.caption || contextLabel(item)}</p>
                <p className="truncate text-slate-500">{item.originalFilename}</p>
                {image?.error && (
                  <Button type="button" variant="ghost" className="w-full" onClick={() => void load(item)}>
                    <RefreshCw className="size-4" /> Tentar novamente
                  </Button>
                )}
                {!readonly && (
                  <Button type="button" variant="ghost" className="w-full text-red-700" onClick={() => void remove(item)}>
                    <Trash2 className="size-4" /> Excluir
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <Modal open={selected !== null} title={selected ? contextLabel(selected) : "Foto"} onClose={() => setSelected(null)}>
        {selected && images[selected.id]?.url && (
          <div className="space-y-3">
            <img src={images[selected.id].url} alt={selected.caption || contextLabel(selected)} className="max-h-[70vh] w-full object-contain" />
            {selected.caption && <p className="text-sm text-slate-700">{selected.caption}</p>}
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setSelected(null)}>Fechar</Button>
          </div>
        )}
      </Modal>
    </>
  );
}
