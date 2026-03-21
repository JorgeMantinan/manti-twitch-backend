const tmi = require('tmi.js');
const raffleManager = require('./raffleManager');

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
        const { state } = raffleManager;
        if (!state.active || self) return;
        if (channel.replace("#", "") !== state.twitchChannel) return;
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