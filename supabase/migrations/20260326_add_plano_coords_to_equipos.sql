alter table public.equipos
add column if not exists plano_id bigint,
add column if not exists x_pct numeric(6,3),
add column if not exists y_pct numeric(6,3);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipos_plano_id_fkey'
  ) then
    alter table public.equipos
    add constraint equipos_plano_id_fkey
      foreign key (plano_id) references public.planos(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipos_x_pct_check'
  ) then
    alter table public.equipos
    add constraint equipos_x_pct_check
      check (x_pct is null or (x_pct >= 0 and x_pct <= 100));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipos_y_pct_check'
  ) then
    alter table public.equipos
    add constraint equipos_y_pct_check
      check (y_pct is null or (y_pct >= 0 and y_pct <= 100));
  end if;
end $$;

create index if not exists equipos_plano_id_idx
  on public.equipos (plano_id);

comment on column public.equipos.plano_id is
  'Plano asociado al equipo para su ubicacion visual dentro de la oficina.';

comment on column public.equipos.x_pct is
  'Posicion horizontal del equipo dentro del plano, en porcentaje de 0 a 100.';

comment on column public.equipos.y_pct is
  'Posicion vertical del equipo dentro del plano, en porcentaje de 0 a 100.';
