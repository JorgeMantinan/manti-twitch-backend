const {
    createBattle,
    stepBattle,
    applyCommand,
    snapshot,
    drainEvents,
} = require("../utils/shipsEngine");

const TICK_MS = 1000 / 30;
const STATE_EVERY_TICKS = 2;
const ROOM_TTL_MS = 90 * 1000;

const COOLDOWNS = {
    ammo: 8,
    fire: 3,
    shield: 6,
};

const channelKey = (channel) =>
    String(channel || "")
        .toLowerCase()
        .replace(/^#/, "")
        .trim();

const parseCommand = (message) => {
    const text = String(message || "").trim();
    if (!text.startsWith("!")) return null;

    const match = text.match(/^!(municion|munición|fuego|blindaje)\b\s*(.*)$/i);
    if (!match) return null;

    const cmd = match[1].toLowerCase().replace("munición", "municion");
    const target = match[2].trim();

    if (cmd === "municion") return { type: "ammo", target: null };
    if (cmd === "fuego") return { type: "fire", target };
    if (cmd === "blindaje") return { type: "shield", target };

    return null;
};

class ShipsManager {
    constructor() {
        this.io = null;
        this.rooms = new Map();
        this.byChannel = new Map();
        this.lastCommand = new Map();
        this.timer = null;
    }

    init(io) {
        this.io = io;
        if (this.timer) return;

        this.timer = setInterval(() => this.tick(), TICK_MS);
        if (typeof this.timer.unref === "function") this.timer.unref();
    }

    start(streamer, participants, opts = {}) {
        const battle = createBattle(participants, opts);
        const room = {
            streamer,
            battle,
            channel: opts.channel ? channelKey(opts.channel) : null,
            ticks: 0,
            lastAt: Date.now(),
            endedAt: null,
        };

        this.rooms.set(streamer, room);

        if (room.channel) this.byChannel.set(room.channel, streamer);

        return room;
    }

    stop(streamer) {
        const room = this.rooms.get(streamer);
        if (!room) return false;

        if (room.channel && this.byChannel.get(room.channel) === streamer) {
            this.byChannel.delete(room.channel);
        }

        this.rooms.delete(streamer);
        return true;
    }

    get(streamer) {
        return this.rooms.get(streamer) || null;
    }

    handleChat(channel, username, displayName, message) {
        const ch = channelKey(channel);
        const streamer = this.byChannel.get(ch);
        if (!streamer) return null;

        const room = this.rooms.get(streamer);
        if (!room || room.battle.ended) return null;

        const parsed = parseCommand(message);
        if (!parsed) return null;

        const now = Date.now();
        const key = `${ch}:${String(username || "").toLowerCase()}:${parsed.type}`;
        const cooldown = (COOLDOWNS[parsed.type] || 3) * 1000;
        const last = this.lastCommand.get(key) || 0;

        if (now - last < cooldown) {
            return { ok: false, message: "Espera un poco antes de repetir eso" };
        }

        this.lastCommand.set(key, now);

        const result = applyCommand(room.battle, {
            type: parsed.type,
            target: parsed.target,
            by: displayName || username,
        });

        if (!result) return null;

        return { ...result, streamer, channel: ch };
    }

    tick() {
        if (!this.io) return;

        const now = Date.now();

        for (const [streamer, room] of this.rooms) {
            const dt = Math.min(0.05, Math.max(0, (now - room.lastAt) / 1000));
            room.lastAt = now;

            stepBattle(room.battle, dt);

            const events = drainEvents(room.battle);
            room.ticks += 1;

            if (room.battle.ended && !room.endedAt) room.endedAt = now;

            const shouldSend =
                room.ticks % STATE_EVERY_TICKS === 0 || events.length > 0 || room.battle.ended;

            if (shouldSend) {
                this.io.to(`ships:${streamer}`).emit("ships:state", {
                    snapshot: snapshot(room.battle),
                    events,
                });
            }

            if (room.endedAt && now - room.endedAt > ROOM_TTL_MS) {
                this.stop(streamer);
            }
        }
    }
}

module.exports = new ShipsManager();
module.exports.parseCommand = parseCommand;
module.exports.channelKey = channelKey;
