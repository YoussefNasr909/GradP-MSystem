export function computeLevel(lifetimeXp) {
  return Math.floor(Math.sqrt(Math.max(0, lifetimeXp) / 100)) + 1;
}
