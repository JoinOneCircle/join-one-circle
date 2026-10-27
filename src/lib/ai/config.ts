import "server-only";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const CIRCLE_AI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5";
export const getOpenAiKey = () => process.env.OPENAI_API_KEY?.trim() || "";
// AI is outside the school/parent pilot. A stored key alone never enables it.
export const isCircleAiConfigured = () => process.env.CIRCLE_AI_ENABLED === "true" && getOpenAiKey().length > 0;
