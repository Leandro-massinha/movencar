import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { getPublicErrorMessage } from "../services/api";

describe("mensagens públicas da API", () => {
  it("preserva a mensagem pública devolvida pelo backend", () => {
    const error = new AxiosError(
      "Request failed",
      undefined,
      undefined,
      undefined,
      { data: { error: { message: "Credenciais inválidas." } } } as never,
    );
    expect(getPublicErrorMessage(error)).toBe("Credenciais inválidas.");
  });

  it("não expõe mensagens técnicas de rede", () => {
    const error = new AxiosError("Network Error");
    expect(getPublicErrorMessage(error)).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });
});
