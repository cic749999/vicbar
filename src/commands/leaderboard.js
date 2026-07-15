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
    .setName('leaderboard')
    .setDescription('View team leaderboard')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Leaderboard type')
        .setRequired(false)
        .addChoices(
          { name: 'Fantasy Points', value: 'fantasy' },
          { name: 'Games Played', value: 'games' },
          { name: 'QB Stats', value: 'qb' },
          { name: 'WR Stats', value: 'wr' },
          { name: 'RB Stats', value: 'rb' },
          { name: 'CB Stats', value: 'cb' },
          { name: 'DE Stats', value: 'de' }
        )
    ),

  async execute(interaction) {
    const teams = loadTeams();
    const guildId = interaction.guildId;
    const team = teams[guildId];
    const leaderboardType = interaction.options.getString('type') || 'fantasy';

    if (!team) {
      return await interaction.reply({
        content: '❌ Team not set up yet.',
        ephemeral: true
      });
    }

    // Create leaderboard data
    let leaderboardData = [];

    for (const member of team.members) {
      const stats = team.stats[member.discordId] || { fantasyPoints: 0, games: 0, positions: {} };
      
      leaderboardData.push({
        name: member.discordName,
        roblox: member.robloxUsername,
        fantasyPoints: stats.fantasyPoints || 0,
        games: stats.games || 0,
        positions: stats.positions || {},
        positionCount: (stats.positions.QB || 0) + (stats.positions.WR || 0) + 
                      (stats.positions.RB || 0) + (stats.positions.CB || 0) + 
                      (stats.positions.DE || 0) + (stats.positions.K || 0)
      });
    }

    // Sort based on type
    if (leaderboardType === 'fantasy') {
      leaderboardData.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
    } else if (leaderboardType === 'games') {
      leaderboardData.sort((a, b) => b.games - a.games);
    } else {
      // Position-specific
      const posKey = leaderboardType.toUpperCase();
      leaderboardData.sort((a, b) => (b.positions[posKey] || 0) - (a.positions[posKey] || 0));
    }

    leaderboardData = leaderboardData.slice(0, 20);

    // Build embed
    const typeNames = {
      fantasy: '⭐ Fantasy Points Leaderboard',
      games: '🎮 Games Played Leaderboard',
      qb: '🏈 Quarterback Stats',
      wr: '📡 Wide Receiver Stats',
      rb: '💨 Running Back Stats',
      cb: '🛡️ Cornerback Stats',
      de: '⚔️ Defensive End Stats'
    };

    const embed = new EmbedBuilder()
      .setColor('#1f8b4c')
      .setTitle(typeNames[leaderboardType])
      .setFooter({ text: 'Top 20 Players' })
      .setTimestamp();

    let leaderboardText = '';
    leaderboardData.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      
      if (leaderboardType === 'fantasy') {
        leaderboardText += `${medal} **${player.name}** (${player.roblox})\n   ⭐ ${player.fantasyPoints} pts | 🎮 ${player.games} games\n\n`;
      } else if (leaderboardType === 'games') {
        leaderboardText += `${medal} **${player.name}** - ${player.games} games\n`;
      } else {
        const posKey = leaderboardType.toUpperCase();
        leaderboardText += `${medal} **${player.name}** - ${player.positions[posKey] || 0} times\n`;
      }
    });

    embed.setDescription(leaderboardText || 'No stats yet');
    await interaction.reply({ embeds: [embed] });
  }
};
