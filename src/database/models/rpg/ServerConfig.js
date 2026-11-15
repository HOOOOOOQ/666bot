'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    customPrefix: { type: String, default: null, maxlength: 5 },
    disabledCommands: { type: [String], default: [] },
    censorEnabled: { type: Boolean, default: false },
    censoredWords: { type: [String], default: [] },
    rules: { type: [String], default: [] },
    announcementChannelId: { type: String, default: null },
    suggestionChannelId: { type: String, default: null },
    logChannelId: { type: String, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'server_configs' },
);

module.exports = model('ServerConfig', schema);
