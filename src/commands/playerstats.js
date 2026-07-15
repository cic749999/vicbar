const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const teamsFile = path.join(__dirname, '../data/teams.json');

function loadTeams() {
  if (fs.existsSync(teamsFile)) {
    return JSON.parse(fs.readFileSync(teamsFile, 'utf-8'));
  }
  return {};
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playerstats')
    .setDescription('View a player\'s detailed statistics')
    .addUserOption(option =>
      option.setName('player')
        .setDescription('Discord user to check stats for')
        .setRequired(false)
    ),

  async execute(interaction) {
    const teams = loadTeams();
    const guildId = interaction.guildId;
    const team = teams[guildId];
    const user = interaction.options.getUser('player') || interaction.user;

    if (!team) {
      return await interaction.reply({
        content: '❌ Team not set up yet.',
        ephemeral: true
      });
    }

    const member = team.members.find(m => m.discordId === user.id);
    if (!member) {
      return await interaction.reply({
        content: '❌ Player not in team roster.',
        ephemeral: true
      });
    }

    const stats = team.stats[user.id] || { fantasyPoints: 0, games: 0, positions: {}, grades: [] };

    const embed = new EmbedBuilder()
      .setColor('#1f8b4c')
      .setTitle(`📊 ${member.discordName}'s Stats`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Roblox Username', value: member.robloxUsername, inline: true },
        { name: 'Fantasy Points', value: stats.fantasyPoints.toString(), inline: true },
        { name: 'Games Played', value: stats.games.toString(), inline: true },
        { name: '⭐ Avg per Game', value: stats.games > 0 ? (Math.round(stats.fantasyPoints / stats.games * 100) / 100).toString() : '0', inline: true }
      )
      .setFooter({ text: 'Team Stats | Football Fusion' })
      .setTimestamp();

    // Position breakdown
    if (Object.keys(stats.positions).length > 0) {
      let posText = '';
      for (const [pos, count] of Object.entries(stats.positions)) {
        posText += `${pos}: ${count}\n`;
      }
      embed.addField('Position Breakdown', posText, true);
    }

    // Grade history
    if (stats.grades && stats.grades.length > 0) {
      const recentGrades = stats.grades.slice(-5).map(g => `${g.letter} (${g.reason})`).join('\n');
      embed.addField('Recent Game Grades', recentGrades, false);
    }

    await interaction.reply({ embeds: [embed] });
  }
};
