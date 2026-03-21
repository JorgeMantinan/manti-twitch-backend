class RaffleManager {
    constructor() {
        this.state = {
            active: false,
            selectedStreamer: null,
            twitchChannel: null,
            game: "roulette",
            keyword: "",
            subMult: 1,
            giftMult: 1,
            startDate: null,
            endDate: null,
            cachedSubs: new Map(),
            participants: new Map(),
        };
    }

    reset(config) {
        this.state = { ...this.state, ...config, active: true, participants: new Map() };
    }

    addParticipant(username, displayName, userData) {
        if (!this.state.active || this.state.participants.has(username)) return null;

        let points = 1;
        if (userData) {
            if (userData.isSub) points *= this.state.subMult;
            if (userData.giftsSent > 0) points += userData.giftsSent * this.state.giftMult;
        }

        const participant = { username: displayName, points, isSub: !!userData?.isSub, giftsSent: userData?.giftsSent || 0 };
        this.state.participants.set(username, participant);
        return participant;
    }

    stop() {
        this.state.active = false;
        return Array.from(this.state.participants.values()).sort((a, b) => b.points - a.points);
    }
}

module.exports = new RaffleManager();