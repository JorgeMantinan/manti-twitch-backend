const ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

const PHRASES = [
  "A una bala",
  "Si es que estoy solo",
  "Te la dedico Black",
  "Ema te la dedico",
  "Manti perro",
  "Vamos cogerme los pezones y estirarlos",
];

const MAX_MISSES = 6;

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
        };
    }
    return ahorcadoRooms[streamer];
};

const channelKey = (channel) => normalize(channel).replace(/^#/, "");

const setActiveGame = (streamer, twitchChannel, phrase) => {
    const key = channelKey(twitchChannel);
    if (!key) return null;
    activeGames[key] = { streamer, phrase, guessed: false };
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

module.exports = {
    ALPHABET,
    PHRASES,
    MAX_MISSES,
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
};
