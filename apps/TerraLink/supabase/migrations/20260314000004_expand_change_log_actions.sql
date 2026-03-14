-- Expand change_log.action CHECK to include ingestion and soft-delete actions

ALTER TABLE public.change_log
  DROP CONSTRAINT IF EXISTS change_log_action_check;

ALTER TABLE public.change_log
  ADD CONSTRAINT change_log_action_check
  CHECK (action IN (
    'insert','update','delete','status_change','share','unshare',
    'trigger_ingestion','run_sample_ingestion','soft_delete'
  ));
