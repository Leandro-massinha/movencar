import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../contexts/AuthContext";
import { CheckInPage } from "../pages/CheckInPage";
import { workshopApi } from "../services/workshop";
import type { Permission, TenantContext, User } from "../types/auth";

const permissions: Permission[] = [
  "checkins.view",
  "checkins.create",
  "checkins.update",
  "checkins.complete",
];
const user: User = {
  id: "u",
  name: "Técnico",
  email: "tecnico@example.invalid",
  role: "Tecnico",
  permissions,
};
const tenant: TenantContext = {
  companyId: "empresa-a",
  companyName: "Oficina",
  branchId: "filial-a",
  branchName: "Matriz",
  enabledModules: ["core", "workshop"],
};

function renderCheckIn() {
  return render(
    <AuthContext.Provider
      value={{
        user,
        tenant,
        authenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        setBranch: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={["/ordens-servico/demo-os-1842/check-in"]}>
        <Routes>
          <Route path="/ordens-servico/:id/check-in" element={<CheckInPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("evidências no fluxo do Check-in", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => `blob:foto-${crypto.randomUUID()}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("envia foto geral e foto vinculada à avaria, atualizando a quantidade", async () => {
    renderCheckIn();
    expect(await screen.findByText("Fotos da vistoria")).toBeInTheDocument();
    expect(screen.getByText("Foto obrigatória")).toBeInTheDocument();
    expect(screen.getByText("Foto obrigatória se houver problema")).toBeInTheDocument();
    expect(screen.getByText("Foto pendente")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma foto adicionada")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Categoria da foto"), {
      target: { value: "ODOMETER" },
    });
    fireEvent.change(screen.getByLabelText("Foto"), {
      target: {
        files: [new File(["foto"], "odometro.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar foto" }));
    expect(await screen.findByText("odometro.jpg")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /^Capô, sem avarias registradas$/ }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Registrar avaria" })).getByRole(
        "button",
        { name: "Registrar avaria" },
      ),
    );
    const damageDialog = await screen.findByRole("dialog", {
      name: "Fotos da avaria · Capô",
    });
    expect(within(damageDialog).getByText("Nenhuma foto adicionada")).toBeInTheDocument();
    fireEvent.change(within(damageDialog).getByLabelText("Foto"), {
      target: {
        files: [new File(["foto"], "risco.webp", { type: "image/webp" })],
      },
    });
    fireEvent.click(within(damageDialog).getByRole("button", { name: "Enviar foto" }));
    expect(await within(damageDialog).findByText("risco.webp")).toBeInTheDocument();
    fireEvent.click(within(damageDialog).getByTitle("Fechar"));
    expect(await screen.findByRole("button", { name: "Fotos (1)" })).toBeInTheDocument();
  }, 30_000);

  it("lista pendências de conclusão e leva ao primeiro item", async () => {
    vi.spyOn(workshopApi, "completeCheckIn").mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          error: {
            code: "CHECKLIST_PHOTO_REQUIRED",
            message: "Existem itens que exigem foto.",
            details: { items: [{ itemId: "ext-0", label: "Para-choque dianteiro" }] },
          },
        },
      },
    });
    renderCheckIn();
    fireEvent.click(await screen.findByRole("button", { name: "Concluir Check-in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Existe 1 item que exige foto");
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(document.getElementById("checklist-item-ext-0")).toHaveClass("border-amber-500");
  }, 30_000);

  it("mantém galerias visíveis e oculta upload/exclusão depois de COMPLETED", async () => {
    await workshopApi.completeCheckIn("demo-os-1842");
    renderCheckIn();
    expect(await screen.findByText("Fotos da vistoria")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Foto")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    const photos = await screen.findByRole("button", { name: "Fotos (1)" });
    fireEvent.click(photos);
    const dialog = await screen.findByRole("dialog", { name: "Fotos da avaria · Capô" });
    expect(within(dialog).queryByLabelText("Foto")).not.toBeInTheDocument();
    expect(within(dialog).getByText("risco.webp")).toBeInTheDocument();
  }, 30_000);
});
