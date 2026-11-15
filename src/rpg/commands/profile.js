'use strict';

const profileService = require('../services/profileService');
const { profileEmbed } = require('../ui/embeds');
const { reply, resolveTarget, profileOf } = require('./_helpers');

module.exports = {
  names: ['tprofile', 'tme'],
  async execute(ctx) {
    const target = (await resolveTarget(ctx.message, ctx.args[0])) || {
      id: ctx.userId,
      username: ctx.message.author.username,
      displayAvatarURL: () => ctx.message.author.displayAvatarURL({ extension: 'png', size: 256 }),
    };
    const data = await profileService.profile(ctx.guildId, target.id, profileOf(target));
    return reply(ctx.message, profileEmbed(data, profileOf(target).avatar));
  },
  help: ['`tprofile [@user]` — kartu profil 666 lengkap'],
};
