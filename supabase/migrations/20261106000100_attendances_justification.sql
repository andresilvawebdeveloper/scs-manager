-- A app grava o motivo das faltas justificadas em attendances.justification,
-- mas a coluna não existia: as justificações nunca chegavam a ser gravadas.
alter table public.attendances add column if not exists justification text;
