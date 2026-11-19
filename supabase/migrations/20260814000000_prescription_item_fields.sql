-- ----------------------------------------------------------------------------
-- Receta impresa A6: campos estructurados en prescription_items
-- ----------------------------------------------------------------------------
-- El Decreto 665-12 (art. 7) exige en la receta ordinaria, por medicamento:
-- nombre, concentración, forma farmacéutica, vía, posología, cantidad por toma
-- y por día, y duración. Hasta ahora solo había texto libre (dosage,
-- frequency, duration, instructions). Se agregan columnas OPCIONALES para que
-- las recetas ya registradas sigan siendo válidas tal como están.
--
-- No cambia RLS: prescription_items_insert/update ya limitan la escritura al
-- psiquiatra prescriptor, y el bloqueo por suscripción (20260811) sigue
-- aplicando. log_document_access ya admite 'prescription_records' (20260808).
-- ----------------------------------------------------------------------------
alter table public.prescription_items
  add column if not exists strength text,
  add column if not exists dosage_form text,
  add column if not exists route text,
  add column if not exists units_per_dose text,
  add column if not exists units_per_day text;

comment on column public.prescription_items.strength is 'Concentración del producto (ej. 50 mg, 250 mg/5 ml)';
comment on column public.prescription_items.dosage_form is 'Forma farmacéutica (tableta, cápsula, jarabe...)';
comment on column public.prescription_items.route is 'Vía de administración (oral, sublingual...)';
comment on column public.prescription_items.units_per_dose is 'Cantidad por toma (ej. 1 tableta, 5 ml)';
comment on column public.prescription_items.units_per_day is 'Cantidad total por día (ej. 2 tabletas)';
