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

        // Ahorcado: "!ahorcado <frase>" guesses in chat, validated in real-time (sub check happens here)
        if (ahorcadoEngine.normalize(message).startsWith("!ahorcado")) {
            const guess = ahorcadoEngine.parseGuess(message);
            if (guess) {
                const result = ahorcadoEngine.processChatGuess(
                    channelName,
                    tags.username,
                    tags["display-name"] || tags.username,
                    guess,
                    tags
                );

                if (result?.kind === "miss") {
                    io.to(`ahorcadochan:${result.channel}`).emit("ahorcado:playerMiss", {
                        player: result.player,
                    });
                } else if (result?.kind === "win") {
                    io.to(`ahorcadochan:${result.channel}`).emit("ahorcado:guessed", {
                        player: result.player.name,
                        phrase: result.phrase,
                    });
                }
            }
            return;
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