-- Activa RLS en las tablas públicas del inventario para bloquear el acceso directo
-- con la anon key. La aplicación accede desde Next en servidor usando service_role.
do $$
declare
  table_name text;
  target_tables constant text[] := array[
    'fotos',
    'usuarios',
    'patchpanels',
    'fabricantes',
    'ubicaciones',
    'actuaciones',
    'planos',
    'pantallas',
    'puertos_patchpanel',
    'equipos',
    'puertos',
    'switches'
  ];
begin
  foreach table_name in array target_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I enable row level security',
        table_name
      );
    end if;
  end loop;
end
$$;
