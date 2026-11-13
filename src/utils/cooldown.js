'use strict';

/**
 * Simple in-memory cooldown guard for slash commands / buttons.
 */
class Cooldown {
  constructor(defaultMs = 3000) {
    this.defaultMs = defaultMs;
    this.buckets = new Map();
  }

  /**
   * @returns {{limited: boolean, remainingMs: number}}
   */
  check(key, ms = this.defaultMs) {
    const now = Date.now();
    const expiresAt = this.buckets.get(key) || 0;
    if (expiresAt > now) {
      return { limited: true, remainingMs: expiresAt - now };
    }
    this.buckets.set(key, now + ms);
    return { limited: false, remainingMs: 0 };
  }

  clear() {
    this.buckets.clear();
  }

  prune() {
    const now = Date.now();
    for (const [key, expiresAt] of this.buckets) {
      if (expiresAt <= now) this.buckets.delete(key);
    }
  }
}

const commandCooldown = new Cooldown(3000);
const pruneTimer = setInterval(() => commandCooldown.prune(), 10 * 60 * 1000);
if (typeof pruneTimer.unref === 'function') pruneTimer.unref();

module.exports = { Cooldown, commandCooldown };
