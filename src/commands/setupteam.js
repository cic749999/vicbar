const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
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
    .setName('setupteam')
    .setDescription('Set up your team chat and configure channels')
    .addChannelOption(option =>
      option.setName('roster_channel')
        .setDescription('Channel for roster/members')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('leaderboard_channel')
        .setDescription('Channel for leaderboard updates')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('recap_channel')
        .setDescription('Channel for game recaps and grades')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('team_role')
        .setDescription('Role for team members')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const rosterChannel = interaction.options.getChannel('roster_channel');
    const leaderboardChannel = interaction.options.getChannel('leaderboard_channel');
    const recapChannel = interaction.options.getChannel('recap_channel');
    const teamRole = interaction.options.getRole('team_role');

    const teams = loadTeams();
    teams[guildId] = {
      rosterChannelId: rosterChannel.id,
      leaderboardChannelId: leaderboardChannel.id,
      recapChannelId: recapChannel.id,
      teamRoleId: teamRole.id,
      members: [],
      stats: {}
    };

    saveTeams(teams);

    const embed = new EmbedBuilder()
      .setColor('#1f8b4c')
      .setTitle('✅ Team Chat Setup Complete!')
      .addFields(
        { name: 'Roster Channel', value: rosterChannel.toString(), inline: true },
        { name: 'Leaderboard Channel', value: leaderboardChannel.toString(), inline: true },
        { name: 'Recap Channel', value: recapChannel.toString(), inline: true },
        { name: 'Team Role', value: teamRole.toString(), inline: true },
        { name: '📋 Next Steps', value: 'Use `/join` to add members to the team roster!' }
      )
      .setFooter({ text: 'Team Bot | Football Fusion' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
