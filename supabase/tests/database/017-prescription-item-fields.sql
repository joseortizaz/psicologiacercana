-- Receta A6: prescription_items tiene los campos estructurados (art. 7 Decreto 665-12)
-- y siguen siendo opcionales para no invalidar las recetas ya registradas.
begin;
select plan(3);

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'prescription_items'
      and column_name in ('strength','dosage_form','route','units_per_dose','units_per_day')),
  5, '1. Existen las 5 columnas estructuradas');

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'prescription_items'
      and column_name in ('strength','dosage_form','route','units_per_dose','units_per_day')
      and is_nullable = 'NO'),
  0, '2. Todas son opcionales (las recetas anteriores siguen válidas)');

select ok(
  pg_get_functiondef('public.log_document_access(text,uuid,text)'::regprocedure) like '%prescription_records%',
  '3. log_document_access admite auditar prescription_records');

select * from finish();
rollback;
