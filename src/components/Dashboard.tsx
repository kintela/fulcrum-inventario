import DashboardContent from "@/components/DashboardContent";
import { fetchEquipos } from "@/lib/supabase";

export default async function Dashboard() {
  const equipos = await fetchEquipos();
  return <DashboardContent equipos={equipos} />;
}
