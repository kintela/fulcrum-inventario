export function formatearImporte(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
    return "—";
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
    minimumIntegerDigits: 1,
    minimumSignificantDigits: 1,
  }).format(Number(valor));
}

export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return "Sin fecha";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(fecha);
}
