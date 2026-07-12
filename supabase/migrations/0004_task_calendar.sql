-- Daily assistant: calendar-ready tasks and WhatsApp reminders.

alter table wa_tasks
  add column if not exists project text,
  add column if not exists remind_at timestamptz,
  add column if not exists reminded_at timestamptz,
  add column if not exists source text not null default 'detected';

create index if not exists idx_wa_tasks_calendar
  on wa_tasks(status, due_at);

create index if not exists idx_wa_tasks_due_reminders
  on wa_tasks(remind_at)
  where status = 'pending' and reminded_at is null;

