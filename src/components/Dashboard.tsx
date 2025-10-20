import DashboardContent from "@/components/DashboardContent";
import { fetchEquipos, fetchPantallasSinEquipo } from "@/lib/supabase";

export default async function Dashboard() {
  const [equipos, pantallasSinEquipo] = await Promise.all([
    fetchEquipos(),
    fetchPantallasSinEquipo(),
  ]);

  return (
    <DashboardContent
      equipos={equipos}
      pantallasSinEquipo={pantallasSinEquipo}
    />
  );
}
