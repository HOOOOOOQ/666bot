'use strict';

/**
 * Single entry point for all Mongoose models.
 *
 * Services import models from here (never directly) which keeps the data layer
 * modular and makes the test-suite able to swap in an in-memory implementation.
 */
const Duo = require('./Duo');
const Invitation = require('./Invitation');
const DailyActivity = require('./DailyActivity');
const StreakHistory = require('./StreakHistory');
const DuoReward = require('./DuoReward');
const UserStat = require('./UserStat');
const GuildConfig = require('./GuildConfig');

module.exports = {
  Duo,
  Invitation,
  DailyActivity,
  StreakHistory,
  DuoReward,
  UserStat,
  GuildConfig,
};
