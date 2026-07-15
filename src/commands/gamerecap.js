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

function gradePerformance(playerData, position, fantasyPoints) {
  let grade = 'B';
  let reason = 'Solid performance';

  if (position === 'QB') {
    const qbData = playerData.qb || {};
    const rating = qbData.rtng || 0;
    if (rating > 100) { grade = 'A'; reason = 'Excellent accuracy'; }
    else if (rating > 80) { grade = 'B+'; reason = 'Good passing'; }
    else if (rating > 60) { grade = 'B'; reason = 'Average game'; }
    else if (rating > 40) { grade = 'B-'; reason = 'Below average'; }
    else { grade = 'C'; reason = 'Struggling QB'; }
  } else if (position === 'WR') {
    const wrData = playerData.wr || {};
    const catch_pct = wrData.catch && wrData.tgt ? (wrData.catch / wrData.tgt) * 100 : 0;
    if (catch_pct > 80) { grade = 'A'; reason = 'Great hands'; }
    else if (catch_pct > 60) { grade = 'B+'; reason = 'Good receiver'; }
    else if (catch_pct > 40) { grade = 'B'; reason = 'Decent catches'; }
    else { grade = 'C'; reason = 'Drop issues'; }
  } else if (position === 'CB' || position === 'DE') {
    const defData = playerData.def || {};
    const dbData = playerData.db || {};
    const totalPressure = (defData.tack || 0) + (defData.sack || 0) + (dbData.defl || 0);
    if (totalPressure > 10) { grade = 'A'; reason = 'Dominant defense'; }
    else if (totalPressure > 7) { grade = 'B+'; reason = 'Strong defense'; }
    else if (totalPressure > 4) { grade = 'B'; reason = 'Good defense'; }
    else { grade = 'C'; reason = 'Limited impact'; }
  }

  return { grade, reason };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamerecap')
    .setDescription('Generate and post a detailed game recap with player grades')
    .addAttachmentOption(option =>
      option.setName('stats_file')
        .setDescription('Game stats JSON file')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const teams = loadTeams();
      const guildId = interaction.guildId;
      const team = teams[guildId];

      if (!team) {
        return await interaction.editReply('❌ Team not set up.');
      }

      const attachment = interaction.options.getAttachment('stats_file');
      const response = await fetch(attachment.url);
      const fileContent = await response.text();

      const jsonMatch = fileContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return await interaction.editReply('❌ No valid JSON found.');
      }

      const gameData = JSON.parse(jsonMatch[0]);

      // Build recap with grades
      const recaps = [];
      const positionalAnalysis = {
        QB: { played: 0, avg: 0, best: null },
        WR: { played: 0, avg: 0, best: null },
        RB: { played: 0, avg: 0, best: null },
        CB: { played: 0, avg: 0, best: null },
        DE: { played: 0, avg: 0, best: null },
        K: { played: 0, avg: 0, best: null }
      };

      for (const [playerId, playerData] of Object.entries(gameData)) {
        const otherData = playerData.other || {};
        const robloxUsername = otherData.name || otherData.display;

        const teamMember = team.members.find(m => 
          m.robloxUsername.toLowerCase() === robloxUsername.toLowerCase()
        );

        if (teamMember) {
          // Calculate fantasy points
          let position = 'MULTI';
          let fantasyPoints = 0;

          // Detect position and calculate (simplified)
          if ((playerData.qb || {}).yds > 0) position = 'QB';
          else if ((playerData.wr || {}).yds > 0) position = 'WR';
          else if ((playerData.rb || {}).yds > 0) position = 'RB';
          else if ((playerData.def || {}).tack > 3) position = 'DE';
          else if ((playerData.db || {}).tgt > 0) position = 'CB';
          else if ((playerData.k || {}).att > 0) position = 'K';

          // Get grade
          const { grade, reason } = gradePerformance(playerData, position, fantasyPoints);

          recaps.push({
            name: teamMember.discordName,
            position,
            grade,
            reason,
            fantasyPoints
          });

          // Update team stats
          if (!team.stats[teamMember.discordId].grades) {
            team.stats[teamMember.discordId].grades = [];
          }
          team.stats[teamMember.discordId].grades.push({ letter: grade, reason });
        }
      }

      saveTeams(teams);

      // Create embeds for recap
      const recapEmbeds = [];

      // Overall game recap
      const overallEmbed = new EmbedBuilder()
        .setColor('#1f8b4c')
        .setTitle('🏈 Game Recap & Performance Grades')
        .setDescription(`Analysis of ${recaps.length} team members`)
        .setFooter({ text: 'Team Performance Review' })
        .setTimestamp();

      recapEmbeds.push(overallEmbed);

      // Grade breakdown by position
      const qbRecap = recaps.filter(r => r.position === 'QB');
      const wrRecap = recaps.filter(r => r.position === 'WR');
      const rbRecap = recaps.filter(r => r.position === 'RB');
      const cbRecap = recaps.filter(r => r.position === 'CB');
      const deRecap = recaps.filter(r => r.position === 'DE');

      // QB Analysis
      if (qbRecap.length > 0) {
        const qbEmbed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('🏈 Quarterbacks')
          .setDescription(qbRecap.map(p => `**${p.name}** - Grade: **${p.grade}**\n${p.reason}`).join('\n\n'))
          .setFooter({ text: 'QB Performance' });
        recapEmbeds.push(qbEmbed);
      }

      // WR Analysis
      if (wrRecap.length > 0) {
        const wrEmbed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('📡 Wide Receivers')
          .setDescription(wrRecap.map(p => `**${p.name}** - Grade: **${p.grade}**\n${p.reason}`).join('\n\n'))
          .setFooter({ text: 'WR Performance' });
        recapEmbeds.push(wrEmbed);
      }

      // RB Analysis
      if (rbRecap.length > 0) {
        const rbEmbed = new EmbedBuilder()
          .setColor('#f39c12')
          .setTitle('💨 Running Backs')
          .setDescription(rbRecap.map(p => `**${p.name}** - Grade: **${p.grade}**\n${p.reason}`).join('\n\n'))
          .setFooter({ text: 'RB Performance' });
        recapEmbeds.push(rbEmbed);
      }

      // CB Analysis
      if (cbRecap.length > 0) {
        const cbEmbed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle('🛡️ Cornerbacks')
          .setDescription(cbRecap.map(p => `**${p.name}** - Grade: **${p.grade}**\n${p.reason}`).join('\n\n'))
          .setFooter({ text: 'CB Performance' });
        recapEmbeds.push(cbEmbed);
      }

      // DE Analysis
      if (deRecap.length > 0) {
        const deEmbed = new EmbedBuilder()
          .setColor('#e67e22')
          .setTitle('⚔️ Defensive Ends')
          .setDescription(deRecap.map(p => `**${p.name}** - Grade: **${p.grade}**\n${p.reason}`).join('\n\n'))
          .setFooter({ text: 'DE Performance' });
        recapEmbeds.push(deEmbed);
      }

      // Standout performances
      const topPerformers = recaps.filter(r => r.grade.startsWith('A')).slice(0, 3);
      const needsWork = recaps.filter(r => r.grade.startsWith('C')).slice(0, 3);

      const analysisEmbed = new EmbedBuilder()
        .setColor('#1f8b4c')
        .setTitle('📈 Game Analysis')
        .addField(
          '⭐ Standout Performers',
          topPerformers.length > 0 ? topPerformers.map(p => `**${p.name}** (${p.grade}) - ${p.reason}`).join('\n') : 'None with A grades',
          false
        )
        .addField(
          '⚠️ Areas to Improve',
          needsWork.length > 0 ? needsWork.map(p => `**${p.name}** (${p.grade}) - ${p.reason}`).join('\n') : 'Great game overall!',
          false
        );

      recapEmbeds.push(analysisEmbed);

      // Send recap to recap channel
      const recapChannel = interaction.guild.channels.cache.get(team.recapChannelId);
      if (recapChannel) {
        for (const embed of recapEmbeds) {
          await recapChannel.send({ embeds: [embed] });
        }
      }

      await interaction.editReply({
        content: '✅ Game recap generated and posted to recap channel!',
        embeds: [recapEmbeds[0]]
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply(`❌ Error: ${error.message}`);
    }
  }
};
