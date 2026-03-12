import { WebClient } from "@slack/web-api";

/** Create a @slack/web-api WebClient instance. */
export function createSlackWebClient(token: string): WebClient {
  return new WebClient(token);
}

/**
 * Minimal Slack Web API client using fetch.
 * Kept for backward compatibility; new code may use createSlackWebClient().
 */
export class SlackClient {
  constructor(private token: string) {}

  async apiCall<T = unknown>(
    method: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`Slack API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data as T;
  }

  async getPermalink(channelId: string, messageTs: string): Promise<string> {
    const result = await this.apiCall<{ permalink: string }>(
      "chat.getPermalink",
      { channel: channelId, message_ts: messageTs },
    );
    return result.permalink;
  }

  async getUserInfo(userId: string) {
    return this.apiCall<{
      user: {
        id: string;
        name: string;
        real_name: string;
        profile: { email?: string; image_72?: string };
      };
    }>("users.info", { user: userId });
  }

  async getChannelInfo(channelId: string) {
    return this.apiCall<{
      channel: {
        id: string;
        name: string;
        is_channel: boolean;
        is_group: boolean;
        is_im: boolean;
        is_mpim: boolean;
      };
    }>("conversations.info", { channel: channelId });
  }
}
