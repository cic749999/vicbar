const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scorereport')
    .setDescription('Submit a game score report with player statistics')
    .addAttachmentOption(option =>
      option.setName('stats_file')
        .setDescription('JSON file containing player stats from Football Fusion')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const attachment = interaction.options.getAttachment('stats_file');

      // Validate file is JSON
      if (!attachment.name.endsWith('.json') && !attachment.name.endsWith('.txt')) {
        return await interaction.editReply({
          content: '❌ Please upload a JSON or TXT file containing the game stats.',
          ephemeral: true
        });
      }

      // Fetch the file content
      const response = await fetch(attachment.url);
      const fileContent = await response.text();

      // Parse JSON
      let gameData;
      try {
        // Extract JSON from the file (in case there's prefix like "42 - 16 ///")
        const jsonMatch = fileContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in file');
        }
        gameData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        return await interaction.editReply({
          content: '❌ Failed to parse JSON file. Please ensure it contains valid game statistics.',
          ephemeral: true
        });
      }

      // Process the stats and create a report
      const playerStats = [];
      let totalPlayers = 0;

      for (const [playerId, playerData] of Object.entries(gameData)) {
        totalPlayers++;
        const otherData = playerData.other || {};
        const qbData = playerData.qb || {};
        const wrData = playerData.wr || {};
        const dbData = playerData.db || {};
        const rbData = playerData.rb || {};
        const defData = playerData.def || {};
        const kData = playerData.k || {};

        // Calculate player score
        let score = 0;
        score += qbData.yds || 0; // QB yards
        score += (qbData.td || 0) * 6; // QB touchdowns
        score -= (qbData.int || 0) * 2; // QB interceptions
        score += wrData.yds || 0; // WR receiving yards
        score += (wrData.td || 0) * 6; // WR touchdowns
        score += wrData.catch || 0; // Catches
        score += rbData.yds || 0; // RB rushing yards
        score += (rbData.td || 0) * 6; // RB touchdowns
        score += (kData.good || 0) * 3; // Field goals
        score += kData.pat_good || 0; // Extra points
        score += (defData.tack || 0) * 0.5; // Tackles
        score += (defData.sack || 0) * 2; // Sacks
        score += (dbData.int || 0) * 2; // Interceptions
        score += (dbData.defl || 0) * 0.5; // Deflections

        playerStats.push({
          name: otherData.display || otherData.name || 'Unknown',
          team: otherData.team || 'N/A',
          score: Math.round(score * 100) / 100,
          wins: otherData.w || 0,
          position: getPosition(playerData),
          stats: {
            qb: qbData,
            wr: wrData,
            db: dbData,
            rb: rbData,
            def: defData,
            k: kData
          }
        });
      }

      // Sort by score descending
      playerStats.sort((a, b) => b.score - a.score);

      // Create embeds for the report
      const embeds = [];

      // Main report embed
      const mainEmbed = new EmbedBuilder()
        .setColor('#1f8b4c')
        .setTitle('🏈 Football Fusion Score Report')
        .setDescription(`Game Statistics from ${totalPlayers} players`)
        .addFields(
          { name: 'Total Players', value: totalPlayers.toString(), inline: true },
          { name: 'Buffalo Boars', value: (playerStats.filter(p => p.team === 'Buffalo Boars').length).toString(), inline: true },
          { name: 'Florida Sharks', value: (playerStats.filter(p => p.team === 'Florida Sharks').length).toString(), inline: true }
        )
        .setFooter({ text: 'Football Fusion Bot | Score Report' })
        .setTimestamp();

      embeds.push(mainEmbed);

      // Top performers embed
      const topPlayersText = playerStats.slice(0, 10).map((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${player.name}** (${player.team})\n   Score: **${player.score}** • Wins: ${player.wins}`;
      }).join('\n\n');

      const topPlayersEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('⭐ Top Performers')
        .setDescription(topPlayersText)
        .setFooter({ text: 'Based on calculated fantasy points' });

      embeds.push(topPlayersEmbed);

      // Team summary embed
      const boarsPlayers = playerStats.filter(p => p.team === 'Buffalo Boars');
      const sharksPlayers = playerStats.filter(p => p.team === 'Florida Sharks');
      
      const boarsTotal = boarsPlayers.reduce((sum, p) => sum + p.score, 0);
      const sharksTotal = sharksPlayers.reduce((sum, p) => sum + p.score, 0);
      const winner = boarsTotal > sharksTotal ? 'Buffalo Boars' : sharksTotal > boarsTotal ? 'Florida Sharks' : 'Tied';

      const teamEmbed = new EmbedBuilder()
        .setColor('#1f8b4c')
        .setTitle('🏆 Team Summary')
        .addFields(
          { 
            name: '🐻 Buffalo Boars', 
            value: `Total Score: **${Math.round(boarsTotal * 100) / 100}**\nPlayers: ${boarsPlayers.length}`, 
            inline: true 
          },
          { 
            name: '🦈 Florida Sharks', 
            value: `Total Score: **${Math.round(sharksTotal * 100) / 100}**\nPlayers: ${sharksPlayers.length}`, 
            inline: true 
          },
          { 
            name: '🎯 Winner', 
            value: winner, 
            inline: false 
          }
        )
        .setFooter({ text: 'Combined fantasy points' });

      embeds.push(teamEmbed);

      // Send all embeds
      await interaction.editReply({ embeds });

    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: `❌ Error processing score report: ${error.message}`,
        ephemeral: true
      });
    }
  }
};

function getPosition(playerData) {
  const positions = [];
  
  if (playerData.qb && playerData.qb.yds > 0) positions.push('QB');
  if (playerData.wr && playerData.wr.yds > 0) positions.push('WR');
  if (playerData.rb && playerData.rb.yds > 0) positions.push('RB');
  if (playerData.db && playerData.db.tgt > 0) positions.push('DB');
  if (playerData.def && playerData.def.tack > 0) positions.push('DEF');
  if (playerData.k && (playerData.k.good > 0 || playerData.k.att > 0)) positions.push('K');
  
  return positions.length > 0 ? positions.join(' / ') : 'Multi';
}
