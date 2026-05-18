-- Add sprint completion events to the gamification outbox.
ALTER TYPE "GamificationEventType" ADD VALUE IF NOT EXISTS 'SPRINT_COMPLETED';
