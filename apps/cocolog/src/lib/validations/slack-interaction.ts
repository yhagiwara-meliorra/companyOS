import { z } from "zod";

/**
 * Zod schemas for Slack interactivity payloads.
 * Slack sends all interactive payloads (message shortcuts, block actions,
 * view submissions) to a single Interactivity Request URL as
 * application/x-www-form-urlencoded with a "payload" field containing JSON.
 */

const SlackTeamSchema = z.object({
  id: z.string(),
  domain: z.string().optional(),
});

const SlackUserSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  username: z.string().optional(),
  team_id: z.string().optional(),
});

const SlackChannelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const SlackMessageSchema = z.object({
  type: z.literal("message"),
  text: z.string(),
  user: z.string().optional(),
  ts: z.string(),
  bot_id: z.string().optional(),
});

/**
 * Slack message shortcut (message_action) payload.
 * Triggered when a user right-clicks a message → selects a shortcut.
 */
export const SlackMessageActionSchema = z.object({
  type: z.literal("message_action"),
  token: z.string(),
  action_ts: z.string(),
  team: SlackTeamSchema,
  user: SlackUserSchema,
  channel: SlackChannelSchema,
  message: SlackMessageSchema,
  callback_id: z.string(),
  trigger_id: z.string(),
  response_url: z.string().url(),
});

export type SlackMessageAction = z.infer<typeof SlackMessageActionSchema>;

/**
 * Discriminated union for all Slack interactivity payloads.
 * Currently handles message_action only; extend with block_actions,
 * view_submission, etc. as needed.
 */
export const SlackInteractionPayloadSchema = z.discriminatedUnion("type", [
  SlackMessageActionSchema,
]);

export type SlackInteractionPayload = z.infer<
  typeof SlackInteractionPayloadSchema
>;
