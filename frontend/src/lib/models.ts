import { ModelOption } from "@/types.ts";

export const defaultModelOptions: ModelOption[] = [
  { id: "gpt-4o-mini", label: "OpenAI GPT-4o mini" },
  { id: "llama3.1:8b", label: "Local Llama 3.1 8B" }
];

const defaultModelLabelMap = Object.fromEntries(
  defaultModelOptions.map((option) => [option.id, option.label])
) as Record<string, string>;

export function getModelLabel(modelId: string): string {
  return defaultModelLabelMap[modelId] ?? modelId;
}
