-- Ajout uniquement : aucun film, aucune série ni aucun lien ne sont supprimés.
begin;
alter table public.media add column if not exists family_classification jsonb;
notify pgrst, 'reload schema';
commit;
