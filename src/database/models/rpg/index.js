'use strict';

/**
 * Expandable RPG collection registry. Imported from the main model registry so
 * `ensureIndexes()` creates every index at boot (autoIndex is disabled).
 */
module.exports = {
  RPGUser: require('./RPGUser'),
  EconomyTransaction: require('./EconomyTransaction'),
  HuntingUser: require('./HuntingUser'),
  Monster: require('./Monster'),
  MonsterCollection: require('./MonsterCollection'),
  Pet: require('./Pet'),
  PetCollection: require('./PetCollection'),
  Battle: require('./Battle'),
  GameSession: require('./GameSession'),
  GameHistory: require('./GameHistory'),
  Quest: require('./Quest'),
  Achievement: require('./Achievement'),
  MarketListing: require('./MarketListing'),
  MarketTransaction: require('./MarketTransaction'),
  TradeSession: require('./TradeSession'),
  Guild: require('./Guild'),
  GuildMember: require('./GuildMember'),
  GuildWar: require('./GuildWar'),
  WorldBoss: require('./WorldBoss'),
  WorldBossSession: require('./WorldBossSession'),
  WorldBossContribution: require('./WorldBossContribution'),
  EconomySettings: require('./EconomySettings'),
  GameSettings: require('./GameSettings'),
  GameCooldown: require('./GameCooldown'),
  SettingsHistory: require('./SettingsHistory'),
  AutoHunt: require('./AutoHunt'),
  Lottery: require('./Lottery'),
  LotteryTicket: require('./LotteryTicket'),
  ServerConfig: require('./ServerConfig'),
  Suggestion: require('./Suggestion'),
};
