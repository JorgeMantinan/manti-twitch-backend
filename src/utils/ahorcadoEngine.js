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

const getAhorcadoRoom = (streamer) => {
    if (!ahorcadoRooms[streamer]) {
        ahorcadoRooms[streamer] = {
            phrase: null,
            drawnLetters: [],
            misses: 0,
            started: false,
            maxMisses: MAX_MISSES,
        };
    }
    return ahorcadoRooms[streamer];
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
};
