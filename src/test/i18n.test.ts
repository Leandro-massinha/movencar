import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";
import { navigation } from "../config/navigation";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDocument,
  formatMileage,
  formatNumber,
  formatPercent,
  formatPhone,
  formatPlate,
  formatPostalCode,
} from "../i18n/formatters";
import {
  customerTypeLabels,
  fuelTypeLabels,
  historyEventLabels,
  moduleLabels,
  moduleStatusLabels,
  statusLabels,
  transmissionLabels,
} from "../i18n/pt-BR";

describe("idioma oficial do produto", () => {
  it("declara pt-BR no documento HTML", () => {
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain("MovenCar | Gestão automotiva");
  });

  it("mantém a navegação em português brasileiro", () => {
    expect(navigation.map(({ label }) => label)).toEqual(
      expect.arrayContaining([
        "Visão Geral",
        "Veículos",
        "Ordens de Serviço",
        "Listas de Verificação",
        "Configurações",
      ]),
    );
  });
});

describe("rótulos de domínio", () => {
  it("traduz status, tipos e combustível sem expor enums", () => {
    expect(statusLabels.ACTIVE).toBe("Ativo");
    expect(customerTypeLabels.COMPANY).toBe("Pessoa jurídica");
    expect(fuelTypeLabels.ELECTRIC).toBe("Elétrico");
    expect(transmissionLabels.AUTOMATIC).toBe("Automático");
  });

  it("traduz o histórico e módulos", () => {
    expect(historyEventLabels.MILEAGE_RECORDED).toBe(
      "Quilometragem registrada",
    );
    expect(historyEventLabels.VEHICLE_CREATED).not.toContain("VEHICLE_");
    expect(moduleStatusLabels.SUSPENDED).toBe("Suspenso");
    expect(moduleLabels.vehicles).toBe("Veículos");
  });
});

describe("formatadores pt-BR", () => {
  it("formata números, moeda e percentual", () => {
    expect(formatNumber(1234.5)).toBe("1.234,5");
    expect(formatCurrency(1234.56).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatPercent(0.125)).toBe("12,5%");
  });

  it("formata data e data com hora", () => {
    const value = new Date(2026, 7, 7, 14, 30);
    expect(formatDate(value)).toBe("07/08/2026");
    expect(formatDateTime(value)).toBe("07/08/2026 14:30");
  });

  it("formata quilometragem e identificadores brasileiros", () => {
    expect(formatMileage(42800)).toBe("42.800 km");
    expect(formatDocument("12345678901")).toBe("123.456.789-01");
    expect(formatDocument("12345678000199")).toBe("12.345.678/0001-99");
    expect(formatPostalCode("01310100")).toBe("01310-100");
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPlate("abc1d23")).toBe("ABC1D23");
  });
});
