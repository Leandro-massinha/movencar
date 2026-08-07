import { describe, expect, it } from "vitest";
import customersPage from "../pages/CustomersPage.tsx?raw";
import dashboardPage from "../pages/DashboardPage.tsx?raw";
import historyPage from "../pages/VehicleHistoryPage.tsx?raw";
import routes from "../routes/AppRoutes.tsx?raw";
import vehiclesPage from "../pages/VehiclesPage.tsx?raw";

describe("linguagem das telas principais", () => {
  it("mantém Visão Geral, Clientes e Veículos em pt-BR", () => {
    expect(dashboardPage).toContain("Visão Geral");
    expect(customersPage).toContain('title="Clientes"');
    expect(vehiclesPage).toContain('title="Veículos"');
  });

  it("mantém os termos oficiais do Histórico do Veículo", () => {
    expect(historyPage).toContain("Histórico do Veículo");
    expect(historyPage).toContain("Quilometragem");
    expect(historyPage).toContain("Adicionar anotação");
    expect(historyPage).toContain("Salvar evento");
  });

  it("mantém estados de acesso e módulo indisponível em pt-BR", () => {
    expect(routes).toContain('title="Acesso negado"');
    expect(routes).toContain("Você não possui permissão");
    expect(routes).toContain("módulo não está disponível");
  });

  it("mantém estados vazios em pt-BR", () => {
    expect(customersPage).toContain("Nenhum cliente encontrado");
    expect(vehiclesPage).toContain("Nenhum veículo encontrado");
    expect(historyPage).toContain("ainda não possui eventos no histórico");
  });
});
