import { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointListOptions,
  CheckpointMetadata,
  CheckpointTuple,
  PendingWrite,
  WRITES_IDX_MAP,
  getCheckpointId,
  maxChannelVersion,
} from "@langchain/langgraph-checkpoint";
import { TASKS } from "@langchain/langgraph-checkpoint";
import { createServiceRoleSupabaseClient } from "../../lib/supabase/admin";

type CheckpointRow = {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  checkpoint_json: string;
  metadata_json: string;
  created_at: string;
};

type WriteRow = {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  task_id: string;
  idx: number;
  channel: string;
  value_json: string;
  created_at: string;
};

function encodeBytes(value: Uint8Array) {
  return Buffer.from(value).toString("base64");
}

function decodeBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function matchesFilter(metadata: CheckpointMetadata, filter?: Record<string, unknown>) {
  if (!filter) return true;
  const metadataRecord = metadata as Record<string, unknown>;
  return Object.entries(filter).every(([key, value]) => metadataRecord[key] === value);
}

export class SupabaseCheckpointer extends BaseCheckpointSaver {
  private supabase = createServiceRoleSupabaseClient();

  private async migratePendingSends(
    checkpoint: Checkpoint,
    threadId: string,
    checkpointNs: string,
    parentCheckpointId: string,
  ) {
    const { data, error } = await this.supabase
      .from("langgraph_writes")
      .select("channel, value_json")
      .eq("thread_id", threadId)
      .eq("checkpoint_ns", checkpointNs)
      .eq("checkpoint_id", parentCheckpointId)
      .eq("channel", TASKS);
    if (error) throw error;

    const pendingSends = await Promise.all(
      (data ?? []).map(async (row) => this.serde.loadsTyped("json", decodeBytes(row.value_json))),
    );

    const mutable = checkpoint as Checkpoint;
    mutable.channel_values ??= {};
    mutable.channel_values[TASKS] = pendingSends;
    mutable.channel_versions ??= {};
    mutable.channel_versions[TASKS] =
      Object.keys(mutable.channel_versions).length > 0
        ? maxChannelVersion(...Object.values(mutable.channel_versions))
        : this.getNextVersion(undefined);
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) return undefined;
    const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) ?? "";
    const checkpointId = getCheckpointId(config);

    let row: CheckpointRow | null = null;
    if (checkpointId) {
      const { data, error } = await this.supabase
        .from("langgraph_checkpoints")
        .select("*")
        .eq("thread_id", threadId)
        .eq("checkpoint_ns", checkpointNs)
        .eq("checkpoint_id", checkpointId)
        .maybeSingle();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await this.supabase
        .from("langgraph_checkpoints")
        .select("*")
        .eq("thread_id", threadId)
        .eq("checkpoint_ns", checkpointNs)
        .order("checkpoint_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      row = data;
    }

    if (!row) return undefined;

    const deserializedCheckpoint = await this.serde.loadsTyped("json", decodeBytes(row.checkpoint_json));
    if (deserializedCheckpoint.v < 4 && row.parent_checkpoint_id) {
      await this.migratePendingSends(
        deserializedCheckpoint,
        row.thread_id,
        row.checkpoint_ns,
        row.parent_checkpoint_id,
      );
    }

    const { data: writeRows, error: writesError } = await this.supabase
      .from("langgraph_writes")
      .select("*")
      .eq("thread_id", row.thread_id)
      .eq("checkpoint_ns", row.checkpoint_ns)
      .eq("checkpoint_id", row.checkpoint_id)
      .order("created_at", { ascending: true });
    if (writesError) throw writesError;

    const pendingWrites = await Promise.all(
      (writeRows ?? []).map(async (w) => [
        w.task_id,
        w.channel,
        await this.serde.loadsTyped("json", decodeBytes(w.value_json)),
      ] as [string, string, unknown]),
    );

    const tuple: CheckpointTuple = {
      config: {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint: deserializedCheckpoint,
      metadata: await this.serde.loadsTyped("json", decodeBytes(row.metadata_json)),
      pendingWrites,
    };

    if (row.parent_checkpoint_id) {
      tuple.parentConfig = {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.parent_checkpoint_id,
        },
      };
    }

    return tuple;
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointNs = config.configurable?.checkpoint_ns as string | undefined;
    const configCheckpointId = config.configurable?.checkpoint_id as string | undefined;
    const beforeCheckpointId = options?.before?.configurable?.checkpoint_id as string | undefined;
    const limit = options?.limit ?? undefined;

    let query = this.supabase
      .from("langgraph_checkpoints")
      .select("*")
      .order("checkpoint_id", { ascending: false });

    if (threadId) query = query.eq("thread_id", threadId);
    if (checkpointNs !== undefined) query = query.eq("checkpoint_ns", checkpointNs);
    if (configCheckpointId) query = query.eq("checkpoint_id", configCheckpointId);
    if (beforeCheckpointId) query = query.lt("checkpoint_id", beforeCheckpointId);
    if (limit !== undefined) query = query.limit(limit);

    const { data: rows, error } = await query;
    if (error) throw error;

    for (const row of rows ?? []) {
      const metadata = (await this.serde.loadsTyped(
        "json",
        decodeBytes(row.metadata_json),
      )) as CheckpointMetadata;
      if (!matchesFilter(metadata, options?.filter)) continue;

      const checkpoint = await this.serde.loadsTyped("json", decodeBytes(row.checkpoint_json));
      if (checkpoint.v < 4 && row.parent_checkpoint_id) {
        await this.migratePendingSends(checkpoint, row.thread_id, row.checkpoint_ns, row.parent_checkpoint_id);
      }

      const { data: writeRows, error: writesError } = await this.supabase
        .from("langgraph_writes")
        .select("*")
        .eq("thread_id", row.thread_id)
        .eq("checkpoint_ns", row.checkpoint_ns)
        .eq("checkpoint_id", row.checkpoint_id)
        .order("created_at", { ascending: true });
      if (writesError) throw writesError;

      const pendingWrites = await Promise.all(
        (writeRows ?? []).map(async (w: WriteRow) => [
          w.task_id,
          w.channel,
          await this.serde.loadsTyped("json", decodeBytes(w.value_json)),
        ] as [string, string, unknown]),
      );

      const tuple: CheckpointTuple = {
        config: {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint,
        metadata,
        pendingWrites,
      };

      if (row.parent_checkpoint_id) {
        tuple.parentConfig = {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.parent_checkpoint_id,
          },
        };
      }

      yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) ?? "";
    if (!threadId) {
      throw new Error('Failed to put checkpoint. Missing "thread_id" in config.configurable.');
    }

    const [[, checkpointBytes], [, metadataBytes]] = await Promise.all([
      this.serde.dumpsTyped(checkpoint),
      this.serde.dumpsTyped(metadata),
    ]);

    const { error } = await this.supabase.from("langgraph_checkpoints").upsert({
      thread_id: threadId,
      checkpoint_ns: checkpointNs,
      checkpoint_id: checkpoint.id,
      parent_checkpoint_id: (config.configurable?.checkpoint_id as string | undefined) ?? null,
      checkpoint_json: encodeBytes(checkpointBytes),
      metadata_json: encodeBytes(metadataBytes),
    });
    if (error) throw error;

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) ?? "";
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;
    if (!threadId) throw new Error('Failed to put writes. Missing "thread_id" in config.configurable.');
    if (!checkpointId) throw new Error('Failed to put writes. Missing "checkpoint_id" in config.configurable.');

    const rows = await Promise.all(
      writes.map(async ([channel, value], idx) => {
        const [, valueBytes] = await this.serde.dumpsTyped(value);
        return {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: checkpointId,
          task_id: taskId,
          idx: WRITES_IDX_MAP[channel] ?? idx,
          channel,
          value_json: encodeBytes(valueBytes),
        };
      }),
    );

    const { error } = await this.supabase.from("langgraph_writes").upsert(rows);
    if (error) throw error;
  }

  async deleteThread(threadId: string): Promise<void> {
    const { error: writesError } = await this.supabase
      .from("langgraph_writes")
      .delete()
      .eq("thread_id", threadId);
    if (writesError) throw writesError;

    const { error } = await this.supabase
      .from("langgraph_checkpoints")
      .delete()
      .eq("thread_id", threadId);
    if (error) throw error;
  }
}
