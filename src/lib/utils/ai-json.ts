import { z } from 'zod';

/**
 * Extract the most likely JSON block from a mixed AI response string.
 * 1) Prefer ```json ... ``` fenced blocks
 * 2) Fallback to the first {...} object in the text
 */
export function extractFirstJsonBlock(text: string): string | null {
  if (!text) return null;

  // Prefer fenced JSON blocks: ```json ... ```
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  // Fallback: first {...} block (greedy but good enough as a guard)
  const objectMatch = text.match(/{[\s\S]*}/);
  if (objectMatch && objectMatch[0]) {
    return objectMatch[0].trim();
  }

  return null;
}

/**
 * Generic helper to safely parse a JSON object from AI text using a zod schema.
 * Returns `null` on any failure instead of throwing.
 */
export function parseJsonWithSchema<T>(
  raw: string,
  schema: z.ZodType<T>
): T | null {
  const jsonBlock = extractFirstJsonBlock(raw) ?? raw.trim();
  if (!jsonBlock) return null;

  try {
    const parsed = JSON.parse(jsonBlock);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.warn('[ai-json] Schema validation failed:', result.error.flatten());
      return null;
    }
    return result.data;
  } catch (error) {
    console.warn('[ai-json] JSON parse failed:', error);
    return null;
  }
}

