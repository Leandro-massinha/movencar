import { currency, locale } from "./pt-BR";

const digits = (value: string) => value.replace(/\D/g, "");
export const formatNumber = (
  value: number,
  options?: Intl.NumberFormatOptions,
) => new Intl.NumberFormat(locale, options).format(value);
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
export const formatPercent = (value: number) =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
export const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
export const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(value))
    .replace(",", "");
export const formatMileage = (value: number) => `${formatNumber(value)} km`;
export const formatDocument = (value: string | null) => {
  if (!value) return "—";
  const raw = digits(value);
  return raw.length === 11
    ? raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : raw.length === 14
      ? raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
      : value;
};
export const formatPostalCode = (value: string) => {
  const raw = digits(value);
  return raw.length === 8 ? raw.replace(/(\d{5})(\d{3})/, "$1-$2") : value;
};
export const formatPhone = (value: string | null) => {
  if (!value) return "—";
  const raw = digits(value);
  if (raw.length === 11)
    return raw.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (raw.length === 10)
    return raw.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return value;
};
export const formatPlate = (value: string | null) =>
  value ? value.replace(/[^a-z0-9]/gi, "").toUpperCase() : "Sem placa";
