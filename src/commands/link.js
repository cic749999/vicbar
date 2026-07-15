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

function saveTeams(teams) {
  const dir = path.dirname(teamsFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Roblox account to your Discord'),
    .addStringOption(option =>
      option.setName('roblox_username')
        .setDescription('Your Roblox username')
        .setRequired(true)
    ),

  async execute(interaction) {
    const teams = loadTeams();
    const guildId = interaction.guildId;
    const user = interaction.user;
    const robloxUsername = interaction.options.getString('roblox_username');

    // Auto-create team structure if doesn't exist
    if (!teams[guildId]) {
      teams[guildId] = {
        rosterChannelId: null,
        leaderboardChannelId: null,
        recapChannelId: null,
        teamRoleId: null,
        members: [],
        stats: {},
        totalGameReports: 0,
        parlays: [],
        tempParlays: {}
      };
    }

    const team = teams[guildId];
    const memberData = {
      discordId: user.id,
      discordName: user.username,
      robloxUsername: robloxUsername,
      joinedAt: new Date().toISOString(),
      stats: {
        games: 0,
        fantasyPoints: 0,
        positions: {},
        gameHistory: []
      }
    };

    // Check if already in team
    const existingMember = team.members.find(m => m.discordId === user.id);
    if (existingMember) {
      existingMember.robloxUsername = robloxUsername;
      saveTeams(teams);
      return await interaction.reply({
        content: `✅ Updated your Roblox username to **${robloxUsername}**!`,
        ephemeral: true
      });
    }

    team.members.push(memberData);
    team.stats[user.id] = { fantasyPoints: 0, games: 0, positions: {}, grades: [], gameReports: 0, gameHistory: [] };
    saveTeams(teams);

    const embed = new EmbedBuilder()
      .setColor('#1f8b4c')
      .setTitle('✅ Account Linked!')
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Discord', value: user.username, inline: true },
        { name: 'Roblox', value: robloxUsername, inline: true },
        { name: 'Team Members', value: team.members.length.toString(), inline: true }
      )
      .setFooter({ text: 'Team Bot | Football Fusion' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
