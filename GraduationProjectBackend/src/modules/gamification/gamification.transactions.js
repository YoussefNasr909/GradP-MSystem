import { Prisma } from "@prisma/client";

export const GAMIFICATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10000,
  timeout: 30000,
};

export const MAX_SERIALIZATION_RETRIES = 3;

export function isPrismaSerializationConflict(error) {
  return error?.code === "P2034";
}
