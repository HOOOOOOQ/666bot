'use strict';

/**
 * Single entry point for all Mongoose models.
 *
 * Only Duo Streak collections live here. Services import models from this file
 * so the test-suite can swap in an in-memory implementation.
 */
const Duo = require('./Duo');
const Invitation = require('./Invitation');
const DailyActivity = require('./DailyActivity');
const StreakHistory = require('./StreakHistory');
const DuoReward = require('./DuoReward');
const UserStat = require('./UserStat');
const GuildConfig = require('./GuildConfig');
const StreakLog = require('./StreakLog');

module.exports = {
  Duo,
  Invitation,
  DailyActivity,
  StreakHistory,
  DuoReward,
  UserStat,
  GuildConfig,
  StreakLog,
};
