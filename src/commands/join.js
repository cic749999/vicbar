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
    .setName('join')
    .setDescription('Join the team roster')
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

    if (!teams[guildId]) {
      return await interaction.reply({
        content: '❌ Team not set up yet. Ask an admin to run `/setupteam`',
        ephemeral: true
      });
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
        positions: {}
      }
    };

    // Check if already in team
    const existingMember = team.members.find(m => m.discordId === user.id);
    if (existingMember) {
      return await interaction.reply({
        content: '❌ You\'re already on the roster!',
        ephemeral: true
      });
    }

    team.members.push(memberData);
    team.stats[user.id] = { fantasyPoints: 0, games: 0, positions: {}, grades: [] };
    saveTeams(teams);

    const embed = new EmbedBuilder()
      .setColor('#1f8b4c')
      .setTitle('✅ Welcome to the Team!')
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
