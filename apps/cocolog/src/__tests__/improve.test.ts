import { describe, it, expect } from "vitest";

// ── SlackSlashCommandSchema ─────────────────────────────────────────────────

describe("SlackSlashCommandSchema", () => {
  it("accepts a valid slash command payload", async () => {
    const { SlackSlashCommandSchema } = await import(
      "@/lib/validations/slack-command"
    );

    const result = SlackSlashCommandSchema.safeParse({
      token: "test-token",
      team_id: "T12345",
      team_domain: "test-team",
      channel_id: "C12345",
      channel_name: "general",
      user_id: "U12345",
      user_name: "testuser",
      command: "/improve",
      text: "明日のミーティングについて教えてください",
      response_url: "https://hooks.slack.com/commands/T12345/response",
      trigger_id: "trigger-123",
      api_app_id: "A12345",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload with only required fields", async () => {
    const { SlackSlashCommandSchema } = await import(
      "@/lib/validations/slack-command"
    );

    const result = SlackSlashCommandSchema.safeParse({
      token: "test-token",
      team_id: "T12345",
      channel_id: "C12345",
      user_id: "U12345",
      command: "/improve",
      text: "hello",
      response_url: "https://hooks.slack.com/commands/T12345/response",
      trigger_id: "trigger-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects payload with invalid response_url", async () => {
    const { SlackSlashCommandSchema } = await import(
      "@/lib/validations/slack-command"
    );

    const result = SlackSlashCommandSchema.safeParse({
      token: "test-token",
      team_id: "T12345",
      channel_id: "C12345",
      user_id: "U12345",
      command: "/improve",
      text: "hello",
      response_url: "not-a-url",
      trigger_id: "trigger-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload missing required fields", async () => {
    const { SlackSlashCommandSchema } = await import(
      "@/lib/validations/slack-command"
    );

    const result = SlackSlashCommandSchema.safeParse({
      token: "test-token",
      team_id: "T12345",
      // missing channel_id, user_id, command, text, response_url, trigger_id
    });
    expect(result.success).toBe(false);
  });
});

// ── ImproveResultSchema ─────────────────────────────────────────────────────

describe("ImproveResultSchema", () => {
  it("validates a full improvement result", async () => {
    const { ImproveResultSchema } = await import(
      "@/lib/anthropic/prompts/improve-message"
    );

    const result = ImproveResultSchema.safeParse({
      improved_text: "明日のミーティングの件についてご確認いただけますでしょうか。",
      tone_reason:
        "元のメッセージは直接的すぎたため、丁寧な表現に調整しました。",
      alternatives: [
        "明日のミーティングについてお時間よろしいでしょうか。",
        "明日の打ち合わせの件、ご都合いかがでしょうか。",
      ],
      scene_label: "request",
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero alternatives", async () => {
    const { ImproveResultSchema } = await import(
      "@/lib/anthropic/prompts/improve-message"
    );

    const result = ImproveResultSchema.safeParse({
      improved_text: "OK",
      tone_reason: "シンプルなメッセージのため、変更不要です。",
      alternatives: [],
      scene_label: "casual",
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 3 alternatives", async () => {
    const { ImproveResultSchema } = await import(
      "@/lib/anthropic/prompts/improve-message"
    );

    const result = ImproveResultSchema.safeParse({
      improved_text: "Test",
      tone_reason: "Test reason",
      alternatives: ["alt1", "alt2", "alt3", "alt4"],
      scene_label: "other",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty improved_text", async () => {
    const { ImproveResultSchema } = await import(
      "@/lib/anthropic/prompts/improve-message"
    );

    const result = ImproveResultSchema.safeParse({
      improved_text: "",
      tone_reason: "Test reason",
      alternatives: [],
      scene_label: "other",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty tone_reason", async () => {
    const { ImproveResultSchema } = await import(
      "@/lib/anthropic/prompts/improve-message"
    );

    const result = ImproveResultSchema.safeParse({
      improved_text: "Test",
      tone_reason: "",
      alternatives: [],
      scene_label: "other",
    });
    expect(result.success).toBe(false);
  });
});

// ── buildImproveResponseBlocks ──────────────────────────────────────────────

describe("buildImproveResponseBlocks", () => {
  it("returns valid Block Kit structure with alternatives", async () => {
    const { buildImproveResponseBlocks } = await import(
      "@/lib/slack/improve-blocks"
    );

    const { text, blocks } = buildImproveResponseBlocks({
      improved_text: "改善されたメッセージ",
      tone_reason: "トーンの理由",
      alternatives: ["代替案1", "代替案2"],
      scene_label: "request",
    });

    expect(text).toContain("改善されたメッセージ");
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);

    // Verify header block exists
    const header = blocks.find(
      (b: unknown) => (b as { type: string }).type === "header",
    );
    expect(header).toBeDefined();

    // Verify context block contains scene label
    const context = blocks.find(
      (b: unknown) => (b as { type: string }).type === "context",
    );
    expect(context).toBeDefined();
  });

  it("omits alternatives section when empty", async () => {
    const { buildImproveResponseBlocks } = await import(
      "@/lib/slack/improve-blocks"
    );

    const { blocks } = buildImproveResponseBlocks({
      improved_text: "改善されたメッセージ",
      tone_reason: "トーンの理由",
      alternatives: [],
      scene_label: "casual",
    });

    // Should not contain "他の表現案" section
    const altSection = blocks.find(
      (b: unknown) =>
        (b as { type: string; text?: { text: string } }).type === "section" &&
        (b as { text?: { text: string } }).text?.text?.includes("他の表現案"),
    );
    expect(altSection).toBeUndefined();
  });

  it("includes alternatives section when present", async () => {
    const { buildImproveResponseBlocks } = await import(
      "@/lib/slack/improve-blocks"
    );

    const { blocks } = buildImproveResponseBlocks({
      improved_text: "テスト",
      tone_reason: "テスト理由",
      alternatives: ["代替案1"],
      scene_label: "feedback",
    });

    // Should contain "他の表現案" section
    const altSection = blocks.find(
      (b: unknown) =>
        (b as { type: string; text?: { text: string } }).type === "section" &&
        (b as { text?: { text: string } }).text?.text?.includes("他の表現案"),
    );
    expect(altSection).toBeDefined();
  });
});

// ── SlackMessageActionSchema ────────────────────────────────────────────────

describe("SlackMessageActionSchema", () => {
  const validPayload = {
    type: "message_action" as const,
    token: "test-token",
    action_ts: "1234567890.123456",
    team: { id: "T12345", domain: "test-team" },
    user: { id: "U12345", name: "testuser" },
    channel: { id: "C12345", name: "general" },
    message: {
      type: "message" as const,
      text: "元のメッセージテキスト",
      user: "U99999",
      ts: "1234567890.000001",
    },
    callback_id: "improve_message",
    trigger_id: "trigger-123",
    response_url: "https://hooks.slack.com/actions/T12345/response",
  };

  it("accepts a valid message_action payload", async () => {
    const { SlackMessageActionSchema } = await import(
      "@/lib/validations/slack-interaction"
    );

    const result = SlackMessageActionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts payload with optional fields omitted", async () => {
    const { SlackMessageActionSchema } = await import(
      "@/lib/validations/slack-interaction"
    );

    const minimal = {
      ...validPayload,
      team: { id: "T12345" },
      user: { id: "U12345" },
      channel: { id: "C12345" },
      message: {
        type: "message" as const,
        text: "テスト",
        ts: "1234567890.000001",
      },
    };
    const result = SlackMessageActionSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("rejects payload with missing message field", async () => {
    const { SlackMessageActionSchema } = await import(
      "@/lib/validations/slack-interaction"
    );

    const { message: _, ...noMessage } = validPayload;
    const result = SlackMessageActionSchema.safeParse(noMessage);
    expect(result.success).toBe(false);
  });

  it("rejects payload with invalid response_url", async () => {
    const { SlackMessageActionSchema } = await import(
      "@/lib/validations/slack-interaction"
    );

    const result = SlackMessageActionSchema.safeParse({
      ...validPayload,
      response_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

// ── SlackInteractionPayloadSchema ──────────────────────────────────────────

describe("SlackInteractionPayloadSchema", () => {
  it("accepts message_action type", async () => {
    const { SlackInteractionPayloadSchema } = await import(
      "@/lib/validations/slack-interaction"
    );

    const result = SlackInteractionPayloadSchema.safeParse({
      type: "message_action",
      token: "test-token",
      action_ts: "1234567890.123456",
      team: { id: "T12345" },
      user: { id: "U12345" },
      channel: { id: "C12345" },
      message: {
        type: "message",
        text: "テスト",
        ts: "1234567890.000001",
      },
      callback_id: "improve_message",
      trigger_id: "trigger-123",
      response_url: "https://hooks.slack.com/actions/T12345/response",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown type", async () => {
    const { SlackInteractionPayloadSchema } = await import(
      "@/lib/validations/slack-interaction"
    );

    const result = SlackInteractionPayloadSchema.safeParse({
      type: "unknown_type",
      token: "test-token",
    });
    expect(result.success).toBe(false);
  });
});

// ── buildImproveShortcutBlocks ──────────────────────────────────────────────

describe("buildImproveShortcutBlocks", () => {
  it("includes original message in quoted block", async () => {
    const { buildImproveShortcutBlocks } = await import(
      "@/lib/slack/improve-blocks"
    );

    const { text, blocks } = buildImproveShortcutBlocks("元のメッセージ", {
      improved_text: "改善されたメッセージ",
      tone_reason: "トーン分析の理由",
      alternatives: [],
      scene_label: "request",
    });

    expect(text).toContain("改善されたメッセージ");

    // Find the section with the original message
    const originalSection = blocks.find(
      (b: unknown) =>
        (b as { type: string; text?: { text: string } }).type === "section" &&
        (b as { text?: { text: string } }).text?.text?.includes(
          "元のメッセージ",
        ),
    );
    expect(originalSection).toBeDefined();
    expect(
      (originalSection as { text: { text: string } }).text.text,
    ).toContain(">");
  });

  it("truncates very long original text", async () => {
    const { buildImproveShortcutBlocks } = await import(
      "@/lib/slack/improve-blocks"
    );

    const longText = "あ".repeat(600);
    const { blocks } = buildImproveShortcutBlocks(longText, {
      improved_text: "改善テスト",
      tone_reason: "テスト",
      alternatives: [],
      scene_label: "casual",
    });

    // The original message section should contain truncated text with "..."
    const originalSection = blocks.find(
      (b: unknown) =>
        (b as { type: string; text?: { text: string } }).type === "section" &&
        (b as { text?: { text: string } }).text?.text?.includes("元の"),
    );
    expect(originalSection).toBeDefined();
    expect(
      (originalSection as { text: { text: string } }).text.text,
    ).toContain("...");
  });

  it("includes alternatives section when present", async () => {
    const { buildImproveShortcutBlocks } = await import(
      "@/lib/slack/improve-blocks"
    );

    const { blocks } = buildImproveShortcutBlocks("テスト", {
      improved_text: "改善テスト",
      tone_reason: "テスト理由",
      alternatives: ["代替案1", "代替案2"],
      scene_label: "feedback",
    });

    const altSection = blocks.find(
      (b: unknown) =>
        (b as { type: string; text?: { text: string } }).type === "section" &&
        (b as { text?: { text: string } }).text?.text?.includes("他の表現案"),
    );
    expect(altSection).toBeDefined();
  });

  it("omits alternatives section when empty", async () => {
    const { buildImproveShortcutBlocks } = await import(
      "@/lib/slack/improve-blocks"
    );

    const { blocks } = buildImproveShortcutBlocks("テスト", {
      improved_text: "改善テスト",
      tone_reason: "テスト理由",
      alternatives: [],
      scene_label: "casual",
    });

    const altSection = blocks.find(
      (b: unknown) =>
        (b as { type: string; text?: { text: string } }).type === "section" &&
        (b as { text?: { text: string } }).text?.text?.includes("他の表現案"),
    );
    expect(altSection).toBeUndefined();
  });

  it("handles multi-line original text with proper quoting", async () => {
    const { buildImproveShortcutBlocks } = await import(
      "@/lib/slack/improve-blocks"
    );

    const { blocks } = buildImproveShortcutBlocks("一行目\n二行目\n三行目", {
      improved_text: "改善テスト",
      tone_reason: "テスト理由",
      alternatives: [],
      scene_label: "other",
    });

    const originalSection = blocks.find(
      (b: unknown) =>
        (b as { type: string; text?: { text: string } }).type === "section" &&
        (b as { text?: { text: string } }).text?.text?.includes("元の"),
    );
    expect(originalSection).toBeDefined();
    const sectionText = (originalSection as { text: { text: string } }).text
      .text;
    // Each line should be quoted with >
    expect(sectionText).toContain(">一行目");
    expect(sectionText).toContain(">二行目");
    expect(sectionText).toContain(">三行目");
  });
});

// ── buildImproveUserMessage ─────────────────────────────────────────────────

describe("buildImproveUserMessage", () => {
  it("wraps draft text in expected format", async () => {
    const { buildImproveUserMessage } = await import(
      "@/lib/anthropic/prompts/improve-message"
    );

    const result = buildImproveUserMessage("テストメッセージ");

    expect(result).toContain('"""');
    expect(result).toContain("テストメッセージ");
    expect(result).toContain("下書き");
  });

  it("handles multi-line draft text", async () => {
    const { buildImproveUserMessage } = await import(
      "@/lib/anthropic/prompts/improve-message"
    );

    const draft = "一行目\n二行目\n三行目";
    const result = buildImproveUserMessage(draft);

    expect(result).toContain("一行目\n二行目\n三行目");
  });
});
