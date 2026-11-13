'use strict';

/**
 * A tiny in-memory MongoDB substitute used by the test-suite.
 *
 * It implements just the subset of the Mongoose API the services rely on
 * (find / findOne / create / updateOne / findOneAndUpdate / countDocuments /
 * distinct) plus unique-index enforcement, so the real production code paths
 * are executed without needing a MongoDB binary in CI.
 */

const crypto = require('node:crypto');

function randomId() {
  return crypto.randomBytes(12).toString('hex');
}

function clone(value) {
  if (value === undefined) return value;
  return structuredClone(value);
}

function duplicateKeyError(key) {
  const error = new Error(`E11000 duplicate key error collection: ${key}`);
  error.code = 11000;
  error.keyValue = { key };
  return error;
}

function valuesAt(doc, pathStr) {
  const parts = String(pathStr).split('.');
  let current = [doc];

  for (const part of parts) {
    const next = [];
    for (const item of current) {
      if (item === null || item === undefined) continue;
      if (Array.isArray(item)) {
        for (const element of item) {
          if (element && typeof element === 'object' && part in element) next.push(element[part]);
        }
      } else if (typeof item === 'object' && part in item) {
        next.push(item[part]);
      }
    }
    current = next;
  }

  return current;
}

function asComparable(value) {
  if (value instanceof Date) return value.getTime();
  return value;
}

function compareValues(a, b) {
  const left = asComparable(a);
  const right = asComparable(b);
  if (left === right) return 0;
  if (left === undefined || left === null) return -1;
  if (right === undefined || right === null) return 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  return String(left) < String(right) ? -1 : 1;
}

function equalsValue(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) {
    const left = new Date(a).getTime();
    const right = new Date(b).getTime();
    if (Number.isFinite(left) && Number.isFinite(right)) return left === right;
  }
  if (a === b) return true;
  return String(a) === String(b);
}

function matchesOperator(values, operator, operand) {
  switch (operator) {
    case '$ne':
      return !values.some((value) => equalsValue(value, operand));
    case '$gt':
      return values.some((value) => compareValues(value, operand) > 0);
    case '$gte':
      return values.some((value) => compareValues(value, operand) >= 0);
    case '$lt':
      return values.some((value) => compareValues(value, operand) < 0);
    case '$lte':
      return values.some((value) => compareValues(value, operand) <= 0);
    case '$in':
      return values.some((value) => operand.some((candidate) => equalsValue(value, candidate)));
    case '$nin':
      return !values.some((value) => operand.some((candidate) => equalsValue(value, candidate)));
    case '$exists':
      return (values.length > 0) === Boolean(operand);
    case '$regex':
      return values.some((value) => new RegExp(operand).test(String(value)));
    case '$not':
      return !matchesCondition(values, operand);
    case '$all':
      return values.some((value) => Array.isArray(value) && operand.every((item) => value.some((v) => equalsValue(v, item))));
    default:
      return false;
  }
}

function matchesCondition(values, condition) {
  if (condition && typeof condition === 'object' && !(condition instanceof Date) && !Array.isArray(condition)) {
    const operators = Object.keys(condition).filter((key) => key.startsWith('$'));
    if (operators.length) {
      return operators.every((operator) => matchesOperator(values, operator, condition[operator]));
    }
    return values.some((value) => {
      if (value && typeof value === 'object') return JSON.stringify(value) === JSON.stringify(condition);
      return equalsValue(value, condition);
    });
  }
  return values.some((value) => equalsValue(value, condition));
}

function matchesFilter(doc, filter) {
  if (!filter || !Object.keys(filter).length) return true;

  for (const [key, condition] of Object.entries(filter)) {
    if (key === '$or') {
      if (!condition.some((subFilter) => matchesFilter(doc, subFilter))) return false;
      continue;
    }
    if (key === '$and') {
      if (!condition.every((subFilter) => matchesFilter(doc, subFilter))) return false;
      continue;
    }
    if (key === '$nor') {
      if (condition.some((subFilter) => matchesFilter(doc, subFilter))) return false;
      continue;
    }
    if (!matchesCondition(valuesAt(doc, key), condition)) return false;
  }

  return true;
}

function extractEqualityFields(filter) {
  const fields = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      const hasOperator = Object.keys(value).some((operator) => operator.startsWith('$'));
      if (hasOperator) continue;
    }
    fields[key] = value;
  }
  return fields;
}

function applyUpdate(doc, update, isInsert = false) {
  let changed = false;

  if (update.$setOnInsert && isInsert) {
    for (const [key, value] of Object.entries(update.$setOnInsert)) {
      doc[key] = clone(value);
      changed = true;
    }
  }

  if (update.$set) {
    for (const [key, value] of Object.entries(update.$set)) {
      if (!equalsValue(doc[key], value) || (doc[key] === undefined && value !== undefined)) changed = true;
      doc[key] = clone(value);
    }
  }

  if (update.$inc) {
    for (const [key, value] of Object.entries(update.$inc)) {
      doc[key] = (Number(doc[key]) || 0) + Number(value);
      changed = true;
    }
  }

  if (update.$max) {
    for (const [key, value] of Object.entries(update.$max)) {
      if (doc[key] === undefined || compareValues(value, doc[key]) > 0) {
        doc[key] = clone(value);
        changed = true;
      }
    }
  }

  if (update.$min) {
    for (const [key, value] of Object.entries(update.$min)) {
      if (doc[key] === undefined || compareValues(value, doc[key]) < 0) {
        doc[key] = clone(value);
        changed = true;
      }
    }
  }

  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      delete doc[key];
      changed = true;
    }
  }

  if (update.$push) {
    for (const [key, value] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[key])) doc[key] = [];
      doc[key].push(clone(value?.$each ? value.$each : value));
      changed = true;
    }
  }

  return changed;
}

class Query {
  constructor(model, filter, mode = 'find') {
    this.model = model;
    this.filter = filter || {};
    this.mode = mode;
    this.sortSpec = null;
    this.skipCount = 0;
    this.limitCount = null;
  }

  sort(spec) {
    this.sortSpec = spec;
    return this;
  }

  skip(count) {
    this.skipCount = count;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  select() {
    return this;
  }

  lean() {
    return this;
  }

  async exec() {
    let docs = this.model.docs.filter((doc) => matchesFilter(doc, this.filter));

    if (this.sortSpec) {
      const entries = Object.entries(this.sortSpec);
      docs = [...docs].sort((a, b) => {
        for (const [field, direction] of entries) {
          const left = valuesAt(a, field)[0];
          const right = valuesAt(b, field)[0];
          const result = compareValues(left, right);
          if (result !== 0) return result * direction;
        }
        return 0;
      });
    }

    if (this.mode === 'findOne') {
      return docs.length ? clone(docs[0]) : null;
    }

    if (this.skipCount) docs = docs.slice(this.skipCount);
    if (this.limitCount !== null) docs = docs.slice(0, this.limitCount);
    return docs.map(clone);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

class FakeModel {
  constructor(name, { timestamps = false, unique = [], defaults = null } = {}) {
    this.modelName = name;
    this.timestamps = timestamps;
    this.unique = unique;
    this.defaults = defaults;
    this.docs = [];
  }

  _uniqueKeys(doc) {
    const keys = [];
    for (const rule of this.unique) {
      const result = rule.keys(doc);
      if (Array.isArray(result)) keys.push(...result.filter(Boolean));
    }
    return keys;
  }

  _assertUnique(record) {
    const keys = this._uniqueKeys(record);
    if (!keys.length) return;

    for (const other of this.docs) {
      if (other === record || String(other._id) === String(record._id)) continue;
      const otherKeys = new Set(this._uniqueKeys(other));
      for (const key of keys) {
        if (otherKeys.has(key)) throw duplicateKeyError(`${this.modelName}:${key}`);
      }
    }
  }

  _insert(input) {
    const now = new Date();
    const base = this.defaults ? this.defaults() : {};
    const record = { ...clone(base), _id: randomId(), ...clone(input) };
    if (this.timestamps) {
      record.createdAt = record.createdAt || now;
      record.updatedAt = now;
    }
    this._assertUnique(record);
    this.docs.push(record);
    return clone(record);
  }

  async create(input) {
    if (Array.isArray(input)) return input.map((doc) => this._insert(doc));
    return this._insert(input);
  }

  async insertMany(input) {
    return this.create(input);
  }

  find(filter = {}) {
    return new Query(this, filter, 'find');
  }

  findOne(filter = {}) {
    return new Query(this, filter, 'findOne');
  }

  findById(id) {
    return new Query(this, { _id: id }, 'findOne');
  }

  async countDocuments(filter = {}) {
    return this.docs.filter((doc) => matchesFilter(doc, filter)).length;
  }

  async distinct(field) {
    const values = [];
    for (const doc of this.docs) {
      for (const value of valuesAt(doc, field)) {
        if (Array.isArray(value)) values.push(...value);
        else if (value !== undefined && value !== null) values.push(value);
      }
    }
    return [...new Set(values)];
  }

  async createIndexes() {
    return [{ name: 'fake' }];
  }

  async syncIndexes() {
    return [];
  }

  async updateOne(filter, update, options = {}) {
    const doc = this.docs.find((candidate) => matchesFilter(candidate, filter));

    if (!doc) {
      if (!options.upsert) return { matchedCount: 0, modifiedCount: 0, acknowledged: true };

      const base = extractEqualityFields(filter);
      const record = { ...(this.defaults ? clone(this.defaults()) : {}), _id: randomId(), ...clone(base) };
      applyUpdate(record, update, true);
      if (this.timestamps) {
        record.createdAt = record.createdAt || new Date();
        record.updatedAt = new Date();
      }
      this._assertUnique(record);
      this.docs.push(record);
      return {
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 1,
        upsertedId: record._id,
        acknowledged: true,
      };
    }

    const changed = applyUpdate(doc, update, false);
    if (this.timestamps) doc.updatedAt = new Date();
    this._assertUnique(doc);
    return { matchedCount: 1, modifiedCount: changed ? 1 : 0, acknowledged: true };
  }

  async updateMany(filter, update) {
    const docs = this.docs.filter((doc) => matchesFilter(doc, filter));
    let modified = 0;
    for (const doc of docs) {
      const changed = applyUpdate(doc, update, false);
      if (this.timestamps) doc.updatedAt = new Date();
      this._assertUnique(doc);
      if (changed) modified += 1;
    }
    return { matchedCount: docs.length, modifiedCount: modified, acknowledged: true };
  }

  findOneAndUpdate(filter, update, options = {}) {
    const promise = this._findOneAndUpdate(filter, update, options);
    const wrapper = {
      lean: () => wrapper,
      select: () => wrapper,
      then: (resolve, reject) => promise.then(resolve, reject),
      catch: (reject) => promise.catch(reject),
      finally: (handler) => promise.finally(handler),
    };
    return wrapper;
  }

  async _findOneAndUpdate(filter, update, options = {}) {
    const doc = this.docs.find((candidate) => matchesFilter(candidate, filter));

    if (!doc) {
      if (!options.upsert) return null;
      const base = extractEqualityFields(filter);
      const record = { ...(this.defaults ? clone(this.defaults()) : {}), _id: randomId(), ...clone(base) };
      applyUpdate(record, update, true);
      if (this.timestamps) {
        record.createdAt = record.createdAt || new Date();
        record.updatedAt = new Date();
      }
      this._assertUnique(record);
      this.docs.push(record);
      return clone(record);
    }

    const before = clone(doc);
    applyUpdate(doc, update, false);
    if (this.timestamps) doc.updatedAt = new Date();
    this._assertUnique(doc);
    return options.new === false ? before : clone(doc);
  }

  async deleteOne(filter) {
    const index = this.docs.findIndex((doc) => matchesFilter(doc, filter));
    if (index === -1) return { deletedCount: 0 };
    this.docs.splice(index, 1);
    return { deletedCount: 1 };
  }

  async deleteMany(filter = {}) {
    const before = this.docs.length;
    this.docs = this.docs.filter((doc) => !matchesFilter(doc, filter));
    return { deletedCount: before - this.docs.length };
  }

  reset() {
    this.docs = [];
  }
}

function uniqueRule(keys) {
  return { keys };
}

function createFakeModels() {
  const Duo = new FakeModel('Duo', {
    timestamps: true,
    defaults: () => ({
      status: 'active',
      currentStreak: 0,
      bestStreak: 0,
      totalDays: 0,
      xp: 0,
      lastCompletedDay: null,
      lastReminderDay: null,
      streakStartedAt: null,
      brokenAt: null,
      brokenBy: null,
      breakReason: null,
      notificationsEnabled: true,
      members: [],
    }),
    unique: [uniqueRule((doc) => {
      if (doc.status !== 'active' || !Array.isArray(doc.members)) return [];
      return doc.members.map((member) => `member:${doc.guildId}:${member.userId}`);
    })],
  });

  const Invitation = new FakeModel('Invitation', {
    timestamps: true,
    defaults: () => ({ status: 'pending', respondedAt: null }),
    
    unique: [uniqueRule((doc) => (doc.status === 'pending'
      ? [`pending:${doc.guildId}:${doc.fromUserId}:${doc.toUserId}`]
      : []))],
  });

  const DailyActivity = new FakeModel('DailyActivity', {
    timestamps: true,
    defaults: () => ({ firstMessageAt: new Date() }),
    unique: [uniqueRule((doc) => [`activity:${doc.duoId}:${doc.userId}:${doc.dayKey}`])],
  });

  const StreakHistory = new FakeModel('StreakHistory', {
    timestamps: true,
    defaults: () => ({ streak: 0, xp: 0, note: null, metadata: null }),
    unique: [uniqueRule((doc) => [`history:${doc.duoId}:${doc.dayKey}:${doc.type}`])],
  });

  const DuoReward = new FakeModel('DuoReward', {
    timestamps: true,
    defaults: () => ({ members: [], grantedAt: new Date() }),
    unique: [uniqueRule((doc) => [`reward:${doc.duoId}:${doc.milestone}`])],
  });

  const UserStat = new FakeModel('UserStat', {
    timestamps: true,
    defaults: () => ({
      duoId: null,
      totalActiveDays: 0,
      totalMessages: 0,
      completedDays: 0,
      currentStreak: 0,
      bestStreak: 0,
      duosCount: 0,
      lastActiveDay: null,
      lastActiveAt: null,
    }),
    unique: [uniqueRule((doc) => [`stat:${doc.guildId}:${doc.userId}`])],
  });

  const GuildConfig = new FakeModel('GuildConfig', {
    timestamps: true,
    defaults: () => ({
      timezone: 'Asia/Jakarta',
      notificationsEnabled: true,
      remindersEnabled: true,
      reminderHour: 21,
      reminderMinute: 0,
      notificationChannelId: null,
      activityCooldownSeconds: 60,
      minMessageLength: 3,
      ignoredChannelIds: [],
      xpPerDay: 100,
      lastReminderDay: null,
      lastRolloverDay: null,
    }),
    unique: [uniqueRule((doc) => [`guild:${doc.guildId}`])],
  });

  const models = {
    Duo,
    Invitation,
    DailyActivity,
    StreakHistory,
    DuoReward,
    UserStat,
    GuildConfig,
    __reset() {
      for (const value of Object.values(models)) {
        if (value instanceof FakeModel) value.reset();
      }
    },
  };

  return models;
}

/**
 * Hijacks `src/database/models` for the current test process and returns the
 * fake models. Must be called before requiring any service.
 */
function installFakeDatabase() {
  const models = createFakeModels();
  const modelsPath = require.resolve('../../src/database/models/index.js');

  require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: models,
    children: [],
    paths: [],
  };

  return models;
}

module.exports = {
  installFakeDatabase,
  createFakeModels,
  FakeModel,
  matchesFilter,
  duplicateKeyError,
  randomId,
};
