const tmi = require('tmi.js');
const raffleManager = require('./raffleManager');
const ahorcadoEngine = require('../utils/ahorcadoEngine');

let client;

const initTmi = (io) => {
    client = new tmi.Client({
        options: { debug: false },
        identity: {
            username: "manti_tiri_ri_ti",
            password: `oauth:${process.env.TWITCH_ACCESS_TOKEN}`,
        },
        channels: [],
    });

    client.on("message", (channel, tags, message, self) => {
        if (self) return;

        const channelName = channel.replace("#", "");

        // Ahorcado: detect someone guessing the active phrase in chat
        const activeGame = ahorcadoEngine.getActiveGame(channelName);

        if (activeGame && !activeGame.guessed) {
            if (ahorcadoEngine.normalize(message) === ahorcadoEngine.normalize(activeGame.phrase)) {
                const guessed = ahorcadoEngine.markGuessed(channelName);

                if (guessed) {
                    io.to(`ahorcado:${guessed.streamer}`).emit("ahorcado:guessed", {
                        player: tags["display-name"] || tags.username,
                    });
                }

                return;
            }
        }

        const { state } = raffleManager;
        if (!state.active) return;
        if (channelName !== state.twitchChannel) return;
        if (!message.toLowerCase().includes(state.keyword.toLowerCase())) return;

        const username = tags.username.toLowerCase();
        const participant = raffleManager.addParticipant(
            username, 
            tags["display-name"], 
            state.cachedSubs.get(username)
        );

        if (participant) {
            io.to(`bingo:${state.selectedStreamer}`).emit("newParticipant", {
                participant,
                totalCount: state.participants.size
            });
        }
    });

    client.connect().catch(console.error);
    return client;
};

module.exports = { initTmi, getClient: () => client };