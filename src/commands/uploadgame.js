const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const teamsFile = path.join(__dirname, '../data/teams.json');

const POSITION_SCORING = {
  'QB': { multiplier: 0.6, name: 'Quarterback', bonus: 0 },
  'WR': { multiplier: 1.0, name: 'Wide Receiver', bonus: 0 },
  'RB': { multiplier: 1.0, name: 'Running Back', bonus: 0 },
  'CB': { multiplier: 1.2, name: 'Cornerback', bonus: 10 },
  'DE': { multiplier: 1.3, name: 'Defensive End', bonus: 15 },
  'K': { multiplier: 1.0, name: 'Kicker', bonus: 0 }
};

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

function calculateFantasyPoints(playerData, position) {
  let score = 0;
  const scoring = POSITION_SCORING[position] || { multiplier: 1.0, name: position, bonus: 0 };

  if (position === 'QB') {
    const qbData = playerData.qb || {};
    score += (qbData.yds || 0) * 0.04; // 1 pt per 25 yards
    score += (qbData.td || 0) * 4; // 4 pts per TD
    score -= (qbData.int || 0) * 2; // -2 pts per INT
  } else if (position === 'WR') {
    const wrData = playerData.wr || {};
    score += (wrData.yds || 0) * 0.1; // 1 pt per 10 yards
    score += (wrData.td || 0) * 6; // 6 pts per TD
    score += (wrData.catch || 0) * 1; // 1 pt per catch
  } else if (position === 'RB') {
    const rbData = playerData.rb || {};
    score += (rbData.yds || 0) * 0.1; // 1 pt per 10 yards
    score += (rbData.td || 0) * 6; // 6 pts per TD
  } else if (position === 'CB' || position === 'DE') {
    // Defensive positions get a boost
    const dbData = playerData.db || {};
    const defData = playerData.def || {};
    score += (dbData.tgt || 0) * 0.5;
    score += (dbData.int || 0) * 2;
    score += (defData.tack || 0) * 1; // 1 pt per tackle
    score += (defData.sack || 0) * 2.5; // 2.5 pts per sack (boosted)
    score += (dbData.defl || 0) * 1;
  } else if (position === 'K') {
    const kData = playerData.k || {};
    score += (kData.good || 0) * 3; // 3 pts per FG
    score += (kData.pat_good || 0) * 1; // 1 pt per PAT
  }

  // Apply multiplier and bonus
  score = score * scoring.multiplier + scoring.bonus;
  return Math.round(score * 100) / 100;
}

function detectPosition(playerData) {
  const qbData = playerData.qb || {};
  const wrData = playerData.wr || {};
  const rbData = playerData.rb || {};
  const dbData = playerData.db || {};
  const defData = playerData.def || {};
  const kData = playerData.k || {};

  // Primary position detection
  if (qbData.yds > 0 || qbData.comp > 0) return 'QB';
  if (kData.att > 0 || kData.good > 0) return 'K';
  
  // Check targets for DB vs DE
  if (dbData.tgt > 0 && defData.tack <= 3) return 'CB';
  if (defData.tack > 3 || defData.sack > 0) return 'DE';
  
  // Check receiving yards for WR vs RB
  if (wrData.yds > rbData.yds) return 'WR';
  if (rbData.yds > 0) return 'RB';
  if (wrData.yds > 0) return 'WR';

  return 'MULTI';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uploadgame')
    .setDescription('Upload game stats and update team leaderboards')
    .addAttachmentOption(option =>
      option.setName('stats_file')
        .setDescription('JSON file with game statistics')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('game_name')
        .setDescription('Name of the game (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const teams = loadTeams();
      const guildId = interaction.guildId;
      const team = teams[guildId];

      if (!team) {
        return await interaction.editReply('❌ Team not set up. Use `/setupteam` first.');
      }

      const attachment = interaction.options.getAttachment('stats_file');
      const response = await fetch(attachment.url);
      const fileContent = await response.text();

      const jsonMatch = fileContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return await interaction.editReply('❌ No valid JSON found in file.');
      }

      const gameData = JSON.parse(jsonMatch[0]);

      // Process stats for team members only
      const teamStats = [];
      const leaderboardUpdates = {};

      for (const [playerId, playerData] of Object.entries(gameData)) {
        const otherData = playerData.other || {};
        const robloxUsername = otherData.name || otherData.display || 'Unknown';

        // Find matching team member
        const teamMember = team.members.find(m => 
          m.robloxUsername.toLowerCase() === robloxUsername.toLowerCase()
        );

        if (teamMember) {
          const position = detectPosition(playerData);
          const fantasyPoints = calculateFantasyPoints(playerData, position);

          const memberStat = {
            discordName: teamMember.discordName,
            discordId: teamMember.discordId,
            robloxUsername: robloxUsername,
            position: position,
            fantasyPoints: fantasyPoints,
            playerData: playerData
          };

          teamStats.push(memberStat);

          // Update team stats
          if (!team.stats[teamMember.discordId]) {
            team.stats[teamMember.discordId] = { fantasyPoints: 0, games: 0, positions: {}, grades: [] };
          }

          team.stats[teamMember.discordId].fantasyPoints += fantasyPoints;
          team.stats[teamMember.discordId].games += 1;
          team.stats[teamMember.discordId].positions[position] = (team.stats[teamMember.discordId].positions[position] || 0) + 1;

          leaderboardUpdates[teamMember.discordId] = team.stats[teamMember.discordId];
        }
      }

      saveTeams(teams);

      // Create stats summary
      teamStats.sort((a, b) => b.fantasyPoints - a.fantasyPoints);

      const statsEmbed = new EmbedBuilder()
        .setColor('#1f8b4c')
        .setTitle('📊 Game Stats Uploaded')
        .setDescription(`${teamStats.length} team members found in game data`)
        .setFooter({ text: 'Fantasy points calculated and stored' })
        .setTimestamp();

      const statsText = teamStats.map((s, i) => 
        `${i + 1}. **${s.discordName}** (${s.position}) - **${s.fantasyPoints}** pts`
      ).slice(0, 10).join('\n');

      statsEmbed.addField('Top Performers', statsText || 'No team members found', false);

      await interaction.editReply({ embeds: [statsEmbed] });

      // Send to recap channel
      const recapChannel = interaction.guild.channels.cache.get(team.recapChannelId);
      if (recapChannel) {
        await recapChannel.send({ embeds: [statsEmbed] });
      }

    } catch (error) {
      console.error(error);
      await interaction.editReply(`❌ Error: ${error.message}`);
    }
  }
};
