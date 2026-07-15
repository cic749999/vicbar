const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages] });

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

// Load events
const eventsPath = path.join(__dirname, 'src/events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: '❌ There was an error executing this command!', ephemeral: true });
  }
});

// Handle button interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;

  if (customId.startsWith('confirm_parlay_')) {
    // Handle parlay confirmation
    await interaction.reply('✅ Parlay confirmed!');
  } else if (customId.startsWith('cancel_parlay_')) {
    // Handle parlay cancellation
    await interaction.reply('❌ Parlay cancelled.');
  }
});

// Handle select menu interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  const customId = interaction.customId;

  if (customId.startsWith('select_player_')) {
    // Handle player selection for parlay
    await interaction.reply('✅ Player added to parlay!');
  }
});

client.login(process.env.DISCORD_TOKEN);
