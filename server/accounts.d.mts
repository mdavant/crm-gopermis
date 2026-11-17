import type { PoolClient } from "pg";

export function isValidEmail(email: unknown): boolean;
export function normalizeEmail(email: unknown): string;
export function splitFullName(name: unknown): { firstName: string; lastName: string };
export function redactSensitive(input: unknown): string;
export function hashPassword(password: string): string;
export function verifyPassword(password: string, encoded: unknown): boolean;
export function accountInput(): { identifier: string; password: string; name: string };
export function createAccount(
  client: PoolClient,
  input: { identifier: string; password: string; name: string },
  options?: { initialOnly?: boolean },
): Promise<boolean>;
export function generateTokenHex(bytes?: number): string;
