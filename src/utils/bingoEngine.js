const bingoRooms = {};

const getBingoRoom = (streamer) => {
    if (!bingoRooms[streamer]) {
        bingoRooms[streamer] = { drawn: [], cards: {}, started: false, lineWinner: null, bingoWinner: null };
    }
    return bingoRooms[streamer];
};

const drawNumber = (room) => {
    if (room.drawn.length >= 90) return null;
    let n;
    do { n = Math.floor(Math.random() * 90) + 1; } while (room.drawn.includes(n));
    room.drawn.push(n);
    return n;
};

const checkLine = (card, drawn) => {
    return card.some(row => row.filter(n => n && drawn.includes(n)).length === 5);
};

const checkBingo = (card, drawn) => {
    const hits = card.flat().filter(n => n && drawn.includes(n)).length;
    return hits === 15;
};

module.exports = { getBingoRoom, drawNumber, checkLine, checkBingo };