create table if not exists public.langgraph_checkpoints (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  parent_checkpoint_id text,
  checkpoint_json text not null,
  metadata_json text not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, checkpoint_id)
);

create table if not exists public.langgraph_writes (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  task_id text not null,
  idx integer not null,
  channel text not null,
  value_json text not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, checkpoint_id, task_id, idx),
  foreign key (thread_id, checkpoint_ns, checkpoint_id)
    references public.langgraph_checkpoints(thread_id, checkpoint_ns, checkpoint_id)
    on delete cascade
);

create index if not exists idx_langgraph_checkpoints_thread_ns
  on public.langgraph_checkpoints(thread_id, checkpoint_ns, checkpoint_id desc);

create index if not exists idx_langgraph_writes_thread_ns_checkpoint
  on public.langgraph_writes(thread_id, checkpoint_ns, checkpoint_id);

