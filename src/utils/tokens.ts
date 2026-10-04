/**
 * Lightweight token estimation without pulling in a tokenizer dependency.
 * Heuristic: ~4 characters per token for English-heavy technical text.
 * Used only to decide chunk boundaries, not for billing.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Rough bytes-per-token-independent char budget for a token target. */
export function charsForTokens(tokenBudget: number): number {
  return tokenBudget * 4;
}
