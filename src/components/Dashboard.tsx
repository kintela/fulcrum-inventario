import DashboardContent from "@/components/DashboardContent";
import {
  fetchEquipos,
  fetchPantallasSinEquipo,
  fetchSwitches,
} from "@/lib/supabase";

export default async function Dashboard() {
  const [equipos, pantallasSinEquipo, switches] = await Promise.all([
    fetchEquipos(),
    fetchPantallasSinEquipo(),
    fetchSwitches(),
  ]);

  return (
    <DashboardContent
      equipos={equipos}
      pantallasSinEquipo={pantallasSinEquipo}
      switches={switches}
    />
  );
}
