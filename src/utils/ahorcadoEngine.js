const ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

const PHRASES = [
  "A una bala",
  "Si es que estoy solo",
  "Te la dedico Black",
  "Ema te la dedico",
  "Manti perro",
  "Vamos cogerme los pezones y estirarlos",
  "Soy humilde solo gano",
  "Soy de mando",
  "Mando polla mis cojones",
  "Me falla el lan",
  "Cogerme los pezones y estirarlos",
  "Tapialin va mamado",
  "Lore eres la mejor te quiero",
  "Pochis hace carritos",
  "Hopillo no calvo",
  "Tapialin cervezas artesanales",
  "Machacao machacao machacao",
  "Soy muy cojezno",
  "Mama pochis siempre sincera",
  "Xaraillo gamba blanca",
  "Esta es pulpo o calamar?",
  "Soy pro, propenso a morir",
  "Me recuerda lo que fui y lo que no volverá",
  "Pongo plataforma y me la pela",
  "Os enseño a como no se juega",
  "Rho la unica andaluza que Manti tolera",
  "Lady, hoy para comer fideua?",
  "Que cojo soy",
  "Jaime y Xely pareja sin igual",
  "Ricos pollos medios pollos",
  "Danger promocionamesta",
  "Juansicoya regalame a mewtwo shiny",
  "Mixu mi paraguaya",
  "No mames wey",
  "No se que le habrás hecho a Ema para que te quiera tanto Manti",
  "Me llevo la kill con todo el honor",
];

const MAX_MISSES = 6;
const MAX_PLAYER_MISSES = 6;
const GUESS_PREFIX = "!ahorcado ";

const ahorcadoRooms = {};

// Active ahorcado games keyed by twitch channel, used to detect phrase guesses in chat.
const activeGames = {};

const normalize = (text) => {
    return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
};

const getAhorcadoRoom = (streamer) => {
    if (!ahorcadoRooms[streamer]) {
        ahorcadoRooms[streamer] = {
            phrase: null,
            drawnLetters: [],
            misses: 0,
            started: false,
            guessed: false,
            twitchChannel: null,
            maxMisses: MAX_MISSES,
            players: {},
            subsOnly: false,
        };
    }
    return ahorcadoRooms[streamer];
};

const channelKey = (channel) => normalize(channel).replace(/^#/, "");

const setActiveGame = (streamer, twitchChannel, phrase, subsOnly = false) => {
    const key = channelKey(twitchChannel);
    if (!key) return null;
    activeGames[key] = { streamer, phrase, guessed: false, subsOnly };
    return activeGames[key];
};

const getActiveGame = (twitchChannel) => {
    return activeGames[channelKey(twitchChannel)] || null;
};

const clearActiveGame = (twitchChannel) => {
    const key = channelKey(twitchChannel);
    if (key) delete activeGames[key];
};

const markGuessed = (twitchChannel) => {
    const game = getActiveGame(twitchChannel);
    if (!game || game.guessed) return null;

    game.guessed = true;
    const room = getAhorcadoRoom(game.streamer);
    room.guessed = true;

    return game;
};

const pickPhrase = (index) => {
    const idx = index == null ? Math.floor(Math.random() * PHRASES.length) : index;
    return PHRASES[idx % PHRASES.length];
};

const lettersOf = (phrase) => {
    return Array.from(new Set((phrase || "").toUpperCase().split("").filter(ch => /[A-ZÑ]/.test(ch))));
};

const drawLetter = (room) => {
    if (room.drawnLetters.length >= ALPHABET.length) return null;
    let letter;
    do { letter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; } while (room.drawnLetters.includes(letter));
    room.drawnLetters.push(letter);
    if (!lettersOf(room.phrase).includes(letter)) room.misses += 1;
    return letter;
};

const isComplete = (room) => {
    if (!room.phrase) return false;
    return lettersOf(room.phrase).every(l => room.drawnLetters.includes(l));
};

const isLost = (room) => {
    return room.misses >= room.maxMisses;
};

const parseGuess = (message) => {
    const norm = normalize(message);
    if (!norm.startsWith(GUESS_PREFIX)) return null;
    const guess = norm.slice(GUESS_PREFIX.length).trim();
    return guess || null;
};

const isSubscriber = (tags) => {
    if (!tags) return false;
    if (String(tags.subscriber) === "1") return true;
    const badges = String(tags.badges || "");
    return /(subscriber|founder)\//.test(badges);
};

const registerPlayer = (room, username, displayName) => {
    const key = String(username || "").toLowerCase();
    if (!key) return null;
    if (!room.players[key]) {
        room.players[key] = { username: displayName || username, misses: 0 };
    }
    return room.players[key];
};

const addPlayerMiss = (room, username, displayName) => {
    const player = registerPlayer(room, username, displayName);
    if (!player) return null;
    player.misses += 1;
    return player;
};

const playerEliminated = (room, username) => {
    const key = String(username || "").toLowerCase();
    const player = room.players[key];
    return !!player && player.misses >= MAX_PLAYER_MISSES;
};

const processChatGuess = (channel, username, displayName, guess, tags) => {
    const game = getActiveGame(channel);
    if (!game || game.guessed) return null;

    if (game.subsOnly && !isSubscriber(tags)) return null;

    const room = getAhorcadoRoom(game.streamer);
    if (playerEliminated(room, username)) return null;

    if (normalize(guess) !== normalize(game.phrase)) {
        const player = addPlayerMiss(room, username, displayName);
        if (!player) return null;
        return { kind: "miss", streamer: game.streamer, player: { name: player.username, misses: player.misses } };
    }

    const player = registerPlayer(room, username, displayName);
    markGuessed(channel);
    return { kind: "win", streamer: game.streamer, phrase: game.phrase, player: { name: player.username } };
};

module.exports = {
    ALPHABET,
    PHRASES,
    MAX_MISSES,
    MAX_PLAYER_MISSES,
    GUESS_PREFIX,
    getAhorcadoRoom,
    pickPhrase,
    drawLetter,
    lettersOf,
    isComplete,
    isLost,
    normalize,
    setActiveGame,
    getActiveGame,
    clearActiveGame,
    markGuessed,
    parseGuess,
    isSubscriber,
    registerPlayer,
    addPlayerMiss,
    playerEliminated,
    processChatGuess,
};
