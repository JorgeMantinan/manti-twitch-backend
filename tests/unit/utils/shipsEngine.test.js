const {
    createBattle,
    stepBattle,
    applyCommand,
    snapshot,
    drainEvents,
    findShip,
    SHIP_CLASSES,
    MAX_DURATION,
} = require("../../../src/utils/shipsEngine");
const { parseCommand } = require("../../../src/services/shipsManager");

const PARTICIPANTS = [
    { name: "Ana", isSub: false },
    { name: "Luis", isSub: true },
    { name: "Marta", isSub: false },
];

const noRandom = () => 0.5;

const run = (state, seconds, dt = 1 / 30, rng = noRandom) => {
    const events = [];
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
        stepBattle(state, dt, rng);
        events.push(...drainEvents(state));
    }
    return events;
};

describe("shipsEngine", () => {
    describe("createBattle", () => {
        it("crea un barco por participante", () => {
            const state = createBattle(PARTICIPANTS);
            expect(state.ships).toHaveLength(3);
            expect(state.ships.map((s) => s.name)).toEqual(["Ana", "Luis", "Marta"]);
        });

        it("reparte las clases de barco", () => {
            const state = createBattle(PARTICIPANTS);
            expect(state.ships.map((s) => s.cls)).toEqual([
                "fragata",
                "destructor",
                "acorazado",
            ]);
            expect(SHIP_CLASSES[state.ships[0].cls].label).toBe("Fragata");
        });

        it("los subs tienen mas vida y mas dano", () => {
            const state = createBattle(PARTICIPANTS);
            const sub = state.ships.find((s) => s.isSub);
            const plain = state.ships.find((s) => !s.isSub);
            expect(sub.maxHp).toBeGreaterThan(plain.maxHp);
            expect(sub.damage).toBeGreaterThan(plain.damage);
        });

        it("coloca los barcos repartidos y dentro de la arena", () => {
            const state = createBattle(PARTICIPANTS);
            for (const s of state.ships) {
                expect(s.x).toBeGreaterThan(0);
                expect(s.x).toBeLessThan(1);
                expect(s.y).toBeGreaterThan(0);
                expect(s.y).toBeLessThan(state.aspect);
            }
            const xs = state.ships.map((s) => s.x);
            expect(new Set(xs).size).toBe(3);
        });

        it("respeta el aspect ratio del cliente", () => {
            const state = createBattle(PARTICIPANTS, { aspect: 0.5 });
            expect(state.aspect).toBe(0.5);
        });
    });

    describe("stepBattle", () => {
        let state;
        beforeEach(() => {
            state = createBattle(PARTICIPANTS);
        });

        it("mueve los barcos con el paso del tiempo", () => {
            const before = state.ships.map((s) => ({ x: s.x, y: s.y }));
            run(state, 3);
            const moved = state.ships.some(
                (s, i) => s.x !== before[i].x || s.y !== before[i].y,
            );
            expect(moved).toBe(true);
        });

        it("los barcos permanecen dentro de la arena", () => {
            run(state, 30);
            for (const s of state.ships) {
                expect(s.x).toBeGreaterThanOrEqual(0);
                expect(s.x).toBeLessThanOrEqual(1);
                expect(s.y).toBeGreaterThanOrEqual(0);
                expect(s.y).toBeLessThanOrEqual(state.aspect);
            }
        });

        it("dispara proyectiles", () => {
            const events = run(state, 15);
            expect(events.filter((e) => e.type === "shot").length).toBeGreaterThan(0);
            expect(state.bullets.length).toBeGreaterThanOrEqual(0);
        });

        it("no dispara durante los primeros segundos", () => {
            const events = run(state, 2);
            expect(events.filter((e) => e.type === "shot")).toHaveLength(0);
        });

        it("las balas no pueden danar a su propio barco", () => {
            const ship = state.ships[0];
            state.bullets.push({
                id: 99,
                ownerId: ship.id,
                x: ship.x,
                y: ship.y,
                vx: 0,
                vy: 0,
                life: 1,
                damage: 50,
                isSub: false,
                from: ship.name,
            });
            stepBattle(state, 1 / 30, noRandom);
            expect(ship.hp).toBe(ship.maxHp);
        });

        it("un impacto reduce la vida del objetivo", () => {
            const shooter = state.ships[0];
            const victim = state.ships[1];
            state.bullets.push({
                id: 99,
                ownerId: shooter.id,
                x: victim.x,
                y: victim.y,
                vx: 0,
                vy: 0,
                life: 1,
                damage: 10,
                isSub: false,
                from: shooter.name,
            });
            stepBattle(state, 1 / 30, noRandom);
            expect(victim.hp).toBe(victim.maxHp - 10);
            expect(shooter.damageDealt).toBe(10);
        });

        it("hunde un barco y suma la kill al asesino", () => {
            const shooter = state.ships[0];
            const victim = state.ships[1];
            victim.hp = 5;
            state.bullets.push({
                id: 99,
                ownerId: shooter.id,
                x: victim.x,
                y: victim.y,
                vx: 0,
                vy: 0,
                life: 1,
                damage: 50,
                isSub: false,
                from: shooter.name,
            });
            stepBattle(state, 1 / 30, noRandom);
            expect(victim.alive).toBe(false);
            expect(victim.hp).toBe(0);
            expect(shooter.kills).toBe(1);
        });

        it("emite eventos de disparo, impacto y hundimiento", () => {
            const shooter = state.ships[0];
            const victim = state.ships[1];
            victim.hp = 5;
            state.bullets.push({
                id: 99,
                ownerId: shooter.id,
                x: victim.x,
                y: victim.y,
                vx: 0,
                vy: 0,
                life: 1,
                damage: 50,
                isSub: false,
                from: shooter.name,
            });
            stepBattle(state, 1 / 30, noRandom);
            const events = drainEvents(state);
            expect(events.some((e) => e.type === "hit")).toBe(true);
            expect(events.some((e) => e.type === "sink")).toBe(true);
            expect(drainEvents(state)).toHaveLength(0);
        });

        it("la tormenta se cierra con el tiempo", () => {
            expect(state.stormScale).toBe(1);
            state.t = 60;
            stepBattle(state, 1 / 30, noRandom);
            expect(state.stormScale).toBeLessThan(1);
            state.t = 200;
            stepBattle(state, 1 / 30, noRandom);
            expect(state.stormScale).toBeCloseTo(0.34, 5);
        });

        it("la tormenta daña a quien se queda fuera", () => {
            const s = state.ships[0];
            s.x = 0.02;
            s.y = 0.02;
            state.stormScale = 0.34;
            const hp = s.hp;
            run(state, 2);
            expect(s.hp).toBeLessThan(hp);
            expect(s.inStorm).toBe(true);
        });

        it("termina con un ganador cuando queda un solo barco vivo", () => {
            state.ships[1].alive = false;
            state.ships[1].hp = 0;
            state.ships[2].alive = false;
            state.ships[2].hp = 0;
            stepBattle(state, 1 / 30, noRandom);
            expect(state.ended).toBe(true);
            expect(state.winner).toBe(state.ships[0].id);
        });

        it("termina por tiempo maximo eligiendo al mejor", () => {
            state.t = MAX_DURATION - 0.01;
            state.ships[0].kills = 3;
            stepBattle(state, 1 / 30, noRandom);
            expect(state.ended).toBe(true);
            expect(state.winner).toBe(state.ships[0].id);
        });

        it("no simula si la batalla ya ha terminado", () => {
            state.ended = true;
            const t = state.t;
            stepBattle(state, 1 / 30, noRandom);
            expect(state.t).toBe(t);
        });

        it("acota el delta para no teleportar tras una pausa", () => {
            const before = state.ships[0].x;
            stepBattle(state, 10, noRandom);
            expect(Math.abs(state.ships[0].x - before)).toBeLessThan(0.01);
        });
    });

    describe("applyCommand", () => {
        let state;
        beforeEach(() => {
            state = createBattle(PARTICIPANTS);
        });

        it("!municion recarga a todos los barcos", () => {
            state.ships.forEach((s) => (s.cooldown = 5));
            const res = applyCommand(state, { type: "ammo", by: "Ana" });
            expect(res.ok).toBe(true);
            for (const s of state.ships) {
                expect(s.cooldown).toBe(0);
                expect(s.burst).toBe(1);
            }
        });

        it("!fuego hace disparar a un barco concreto", () => {
            const res = applyCommand(state, { type: "fire", target: "Ana", by: "Luis" });
            expect(res.ok).toBe(true);
            expect(state.bullets).toHaveLength(1);
        });

        it("!fuego falla si el barco no existe", () => {
            const res = applyCommand(state, { type: "fire", target: "Fantasma", by: "Luis" });
            expect(res.ok).toBe(false);
            expect(state.bullets).toHaveLength(0);
        });

        it("!blindaje cura sin pasar del maximo", () => {
            const s = state.ships[0];
            s.hp = 10;
            const res = applyCommand(state, { type: "shield", target: "Ana", by: "Luis" });
            expect(res.ok).toBe(true);
            expect(s.hp).toBe(35);
            applyCommand(state, { type: "shield", target: "Ana", by: "Luis" });
            expect(s.hp).toBeLessThanOrEqual(s.maxHp);
        });

        it("no aplica comandos si la batalla ha terminado", () => {
            state.ended = true;
            expect(applyCommand(state, { type: "ammo", by: "Ana" })).toBeNull();
        });
    });

    describe("findShip", () => {
        it("busca por nombre exacto o parcial", () => {
            const state = createBattle(PARTICIPANTS);
            expect(findShip(state, "ana").id).toBe("s0");
            expect(findShip(state, "mar").id).toBe("s2");
            expect(findShip(state, "zzz")).toBeNull();
        });
    });

    describe("snapshot", () => {
        it("serializa el estado de forma plana", () => {
            const state = createBattle(PARTICIPANTS);
            run(state, 5);
            const snap = snapshot(state);
            expect(snap.ships).toHaveLength(3);
            expect(snap.aspect).toBe(state.aspect);
            expect(typeof snap.storm).toBe("number");
            expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
        });
    });

    describe("parseCommand", () => {
        it("reconoce los comandos de chat", () => {
            expect(parseCommand("!municion")).toEqual({ type: "ammo", target: null });
            expect(parseCommand("!MUNICIÓN")).toEqual({ type: "ammo", target: null });
            expect(parseCommand("!fuego Ana")).toEqual({ type: "fire", target: "Ana" });
            expect(parseCommand("!blindaje Luis")).toEqual({ type: "shield", target: "Luis" });
        });

        it("ignora el chatter normal", () => {
            expect(parseCommand("hola")).toBeNull();
            expect(parseCommand("!otro")).toBeNull();
        });
    });
});
