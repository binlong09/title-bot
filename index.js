const fs = require("node:fs");
const path = require("node:path");
const { token } = require("./config.json");
const {
    Client,
    Events,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    userMention,
    Collection,
} = require("discord.js");
const { isEmpty } = require("lodash");

const dukeQueue = [];
const architectQueue = [];
const scientistQueue = [];

let currentDuke = {};
let currentArchitect = {};
let currentScientist = {};

// 3 minutes
const TITLE_TIMEOUT = 1;
const CHANNEL_NAME = "title-room";

const ERROR_MESSAGE =
    "Invalid format. To request title, please follow the format: TitleName XCoordinate YCoordinate. For example: Duke 321 123";

const TITLE = {
    duke: "duke",
    architect: "architect",
    scientist: "scientist",
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) {
        return;
    }
    if (msg.channel.name === CHANNEL_NAME) {
        const content = msg.content.toLowerCase().split(" ");
        if (content.length < 3) {
            await msg.reply(ERROR_MESSAGE);
            return;
        }
        const title = content[0];
        const author = msg.author.tag;
        const x = content[1];
        const y = content[2];
        console.log(author);
        if (
            ["architect", "duke", "scientist"].some(
                (choice) => title === choice
            )
        ) {
            if (title === TITLE.duke) {
                dukeQueue.push({
                    id: msg.author.id,
                    x,
                    y,
                });
            }

            const response = await msg.reply({
                content: `${title} has been queued for ${userMention(
                    msg.author.id
                )}. You are #${dukeQueue.length} in the ${title} queue.`,
                // components: [row],
            });
        } else {
            await msg.reply(ERROR_MESSAGE);
        }
    }
});

// Check and process duke's queue every 3 seconds
setInterval(async () => {
    console.log(currentDuke);
    const channel = client.channels.cache.find(
        (channel) => channel.name === CHANNEL_NAME
    );
    // current duke is empty
    if (isEmpty(currentDuke) && currentDuke.length > 0) {
        currentDuke = dukeQueue.pop();
        currentDuke = await handleAtLeastOneRequesterInQueue(
            channel,
            "duke",
            currentDuke
        );
        return;
    }

    // current duke is not empty but timer expired
    if (
        !isEmpty(currentDuke) &&
        isTimerExpired(currentDuke.expiredAt) &&
        currentDuke.length > 0
    ) {
        // remove Done button for previous duke
        const messageId = currentDuke.messageId;
        const msg = await channel.messages.fetch(messageId);
        msg.edit({
            content: `${userMention(
                currentDuke.id
            )} Your duke title has expired.`,
            components: [],
        });
        // there is another requester in the queue
        currentDuke = dukeQueue.pop();
        currentDuke = await handleAtLeastOneRequesterInQueue(
            channel,
            "duke",
            currentDuke
        );
        // there is no other requester in the queue
    }
}, 3000);

//  Check and process architect's queue every 3 seconds
setInterval(() => {}, 3000);

// Check and process scientist's queue every 3 seconds
setInterval(() => {}, 3000);

const isTimerExpired = (expiredAt) => {
    return expiredAt < Date.now();
};

const handleAtLeastOneRequesterInQueue = async (
    channel,
    title,
    currentTitle
) => {
    const currentTime = new Date();
    currentTitle.expiredAt = currentTime.setMinutes(
        currentTime.getMinutes() + TITLE_TIMEOUT
    );

    // DO SOMETHING WITH SIMULATOR HERE

    // create Done button so user can prematurely end their session
    const done = new ButtonBuilder()
        .setCustomId(`Done-${currentTitle.id}-${title}}`)
        .setLabel(`Duke Done`)
        .setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(done);

    const response = await channel.send({
        content: `Duke is currently on ${userMention(
            currentTitle.id
        )}. You have 3 minutes.`,
        components: [row],
    });

    currentTitle.messageId = response.id;

    //  Handle Done button
    const collectorFilter = (i) => i.user.id === currentTitle.id;
    try {
        const confirmation = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: 60_000,
        });

        if (confirmation.customId === `Done-${currentTitle.id}-${title}}`) {
            await confirmation.update({
                content: `${userMention(
                    currentTitle.id
                )} has finished with ${title}`,
                components: [],
            });
            currentTitle = {};
        }
    } catch (e) {
        console.log(e);
    }
    return currentTitle;
};

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ping") {
        await interaction.reply({ content: "Secret Pong!", ephemeral: true });
    }
});
client.login(token);

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(
            `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
    }
}
