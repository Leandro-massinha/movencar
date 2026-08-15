import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PhotoEvidenceGallery,
  PhotoEvidenceUploader,
} from "../components/PhotoEvidence";
import type { PhotoEvidence } from "../services/photoEvidence";

const evidence: PhotoEvidence = {
  id: "foto-1",
  category: "FRONT",
  caption: "Vista dianteira",
  sequence: 1,
  originalFilename: "frente.jpg",
  detectedMimeType: "image/jpeg",
  sizeBytes: 4,
  createdAt: "2026-08-15T12:00:00.000Z",
  uploader: { id: "u-1", name: "Técnico" },
};

describe("componentes de evidências fotográficas", () => {
  const createObjectURL = vi.fn(() => "blob:movencar-foto");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  it("mostra preview, envia, mantém erro individual e permite retry", async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce(evidence);
    const uploaded = vi.fn();
    render(<PhotoEvidenceUploader onUpload={upload} onUploaded={uploaded} />);
    const file = new File(["foto"], "frente.jpg", { type: "image/jpeg" });

    fireEvent.change(screen.getByLabelText("Foto"), {
      target: { files: [file] },
    });
    expect(screen.getByAltText("Pré-visualização de frente.jpg")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Legenda de frente.jpg"), {
      target: { value: "Vista dianteira" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar foto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar a foto",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(uploaded).toHaveBeenCalledWith(evidence));
    expect(upload).toHaveBeenLastCalledWith(file, "Vista dianteira");
    expect(screen.getByText("Estado de frente.jpg: concluído.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:movencar-foto");
  });

  it("carrega Blob, amplia, exclui, revoga URL e oferece ações sem hover", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const remove = vi.fn().mockResolvedValue(undefined);

    function Harness() {
      const [items, setItems] = useState([evidence]);
      return (
        <PhotoEvidenceGallery
          evidence={items}
          readonly={false}
          contextLabel={() => "Frente"}
          loadContent={async () => new Blob(["foto"], { type: "image/jpeg" })}
          onDelete={async (id) => {
            await remove(id);
            setItems([]);
          }}
        />
      );
    }

    const { unmount } = render(<Harness />);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Ampliar frente.jpg" }));
    const dialog = screen.getByRole("dialog", { name: "Frente" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByTitle("Fechar"));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("foto-1"));
    expect(screen.getByText("Nenhuma foto adicionada")).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:movencar-foto");
    unmount();
  });

  it("trata falha de download e mantém modo concluído somente leitura", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("indisponível"))
      .mockResolvedValueOnce(new Blob(["foto"], { type: "image/jpeg" }));
    render(
      <PhotoEvidenceGallery
        evidence={[evidence]}
        readonly
        contextLabel={() => "Frente"}
        loadContent={load}
        onDelete={vi.fn()}
      />,
    );
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
