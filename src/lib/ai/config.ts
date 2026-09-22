import "server-only";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const CIRCLE_AI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5";
export const getOpenAiKey = () => process.env.OPENAI_API_KEY?.trim() || "";
export const isCircleAiConfigured = () => getOpenAiKey().length > 0;
