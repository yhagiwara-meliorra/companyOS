import { z } from "zod";

/**
 * Zod schema for Slack slash command payload.
 * Slack sends application/x-www-form-urlencoded, which is parsed
 * into an object via URLSearchParams before validation.
 */
export const SlackSlashCommandSchema = z.object({
  token: z.string(),
  team_id: z.string(),
  team_domain: z.string().optional(),
  channel_id: z.string(),
  channel_name: z.string().optional(),
  user_id: z.string(),
  user_name: z.string().optional(),
  command: z.string(),
  text: z.string(),
  response_url: z.string().url(),
  trigger_id: z.string(),
  api_app_id: z.string().optional(),
  enterprise_id: z.string().optional(),
  enterprise_name: z.string().optional(),
});

export type SlackSlashCommand = z.infer<typeof SlackSlashCommandSchema>;
