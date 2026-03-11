import { z } from "zod";

export const SlackMessageEventSchema = z.object({
  type: z.literal("message"),
  user: z.string(),
  text: z.string(),
  ts: z.string(),
  channel: z.string(),
  channel_type: z.string(),
  subtype: z.string().optional(),
  bot_id: z.string().optional(),
});

export const SlackEventCallbackSchema = z.object({
  type: z.literal("event_callback"),
  team_id: z.string(),
  event_id: z.string().optional(),
  event: SlackMessageEventSchema,
});

export const SlackUrlVerificationSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string(),
});

export const SlackEventPayloadSchema = z.discriminatedUnion("type", [
  SlackUrlVerificationSchema,
  SlackEventCallbackSchema,
]);

export type SlackMessageEvent = z.infer<typeof SlackMessageEventSchema>;
export type SlackEventPayload = z.infer<typeof SlackEventPayloadSchema>;
