import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../contexts/AuthContext";
import { CheckInPage } from "../pages/CheckInPage";
import { PdcPage } from "../pages/PdcPage";
import { WorkOrdersPage } from "../pages/WorkOrdersPage";
import { ModulePermissionRoute } from "../routes/AppRoutes";
import { workshopApi } from "../services/workshop";
import type { Permission, TenantContext, User } from "../types/auth";

const permissions: Permission[] = [
  "checkins.view",
  "checkins.create",
  "checkins.update",
  "checkins.complete",
  "pdc.view",
  "pdc.create",
  "pdc.update",
  "pdc.complete",
];
const user: User = {
  id: "u",
  name: "Técnico",
  email: "t@example.invalid",
  role: "Tecnico",
  permissions,
};
const tenant: TenantContext = {
  companyId: "a",
  companyName: "Oficina",
  branchId: "b",
  branchName: "Matriz",
  enabledModules: ["core", "customers", "vehicles", "workshop"],
};
const auth = (currentUser: User | null = user, currentTenant = tenant) => ({
  user: currentUser,
  tenant: currentTenant,
  authenticated: Boolean(currentUser),
  login: vi.fn(),
  logout: vi.fn(),
  setBranch: vi.fn(),
});
const renderPage = (element: React.ReactNode, value = auth()) =>
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/ordens-servico/demo-os-1842/check-in"]}>
        <Routes>
          <Route path="/ordens-servico/:id/check-in" element={element} />
          <Route path="/sem-acesso" element={<div>Acesso negado</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe("Check-in visual, damage map and PDC", () => {
  it("loads checklist, shows explicit states, progress and records an issue/damage", async () => {
    renderPage(<CheckInPage />);
    expect(
      await screen.findByText(/Check-in · OS #1842/, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ausência de resposta nunca significa OK."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "OK" }).length,
    ).toBeGreaterThan(5);
    fireEvent.click(screen.getAllByRole("button", { name: "Anormalidade" })[0]);
    await waitFor(() => expect(screen.getByText(/1\/36/)).toBeInTheDocument());
    fireEvent.click(
      screen.getByRole("button", { name: /^Capô, sem avarias registradas$/ }),
    );
    expect(
      screen.getByRole("dialog", { name: "Registrar avaria" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar avaria" }));
    await waitFor(() =>
      expect(screen.getByText(/Capô · Risco/)).toBeInTheDocument(),
    );
  }, 20_000);

  it("offers a real navigation path from the work order to Check-in and PDC", async () => {
    render(
      <AuthContext.Provider value={auth()}>
        <MemoryRouter>
          <WorkOrdersPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(await screen.findByText("OS #1842")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir Check-in/ })).toHaveAttribute(
      "href",
      "/ordens-servico/demo-os-1842/check-in",
    );
    expect(screen.getByRole("link", { name: /Abrir PDC/ })).toHaveAttribute(
      "href",
      "/ordens-servico/demo-os-1842/pdc",
    );
  });

  it("shows concern/check-in separately and supports finding plus readonly completion", async () => {
    await workshopApi.completeCheckIn("demo-os-1842");
    await workshopApi.createPdc("demo-os-1842", { mileage: 42800 });
    render(
      <AuthContext.Provider value={auth()}>
        <MemoryRouter initialEntries={["/ordens-servico/demo-os-1842/pdc"]}>
          <Routes>
            <Route path="/ordens-servico/:id/pdc" element={<PdcPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(
      await screen.findByText(/PDC — Primeiro Diagnóstico do Carro · OS #1842/),
    ).toBeInTheDocument();
    expect(screen.getByText("Relato do cliente")).toBeInTheDocument();
    expect(screen.getByText("Resumo do Check-in")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar achado/ }));
    const dialog = screen.getByRole("dialog", {
      name: "Adicionar achado do PDC",
    });
    fireEvent.change(within(dialog).getByLabelText("Descrição"), {
      target: { value: "Pastilhas com desgaste" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Adicionar achado" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Pastilhas com desgaste")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Concluir PDC" }));
    await waitFor(() =>
      expect(screen.getByText("Concluído")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /Adicionar achado/ }),
    ).toBeDisabled();
  });

  it("blocks the route without permission or workshop module", () => {
    const noPermission = { ...user, permissions: [] };
    renderPage(
      <ModulePermissionRoute p="checkins.view">
        <CheckInPage />
      </ModulePermissionRoute>,
      auth(noPermission),
    );
    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
  });
});
