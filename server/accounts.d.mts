import type { PoolClient } from "pg";
export function verifyPassword(password: string, encoded: unknown): boolean;
export function createAccount(
  client: PoolClient,
  input: { identifier: string; password: string; name: string },
  options?: { initialOnly?: boolean },
): Promise<boolean>;
