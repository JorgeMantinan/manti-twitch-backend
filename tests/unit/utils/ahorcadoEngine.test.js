const {
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
} = require('../../../src/utils/ahorcadoEngine');

describe('ahorcadoEngine', () => {
  describe('PHRASES', () => {
    it('contains the expected phrases', () => {
      expect(PHRASES).toContain('A una bala');
      expect(PHRASES).toContain('Si es que estoy solo');
      expect(PHRASES).toContain('Te la dedico Black');
      expect(PHRASES).toContain('Ema te la dedico');
      expect(PHRASES).toContain('Manti perro');
      expect(PHRASES).toContain('Vamos cogerme los pezones y estirarlos');
      expect(PHRASES).toContain('Soy humilde solo gano');
      expect(PHRASES).toContain('Esta es pulpo o calamar');
      expect(PHRASES).toContain('Lady, hoy para comer fideua');
      expect(PHRASES).toContain('No se que le habrás hecho a Ema para que te quiera tanto Manti');
      expect(PHRASES).toContain('Mirame la cobra');
      expect(PHRASES).toContain('Te gusta bien duro a a, yo soy la de tu autoescuela esa la de tu esquela a que no te fijabas en mi a a ahora ya te fijas a y ahora yo te digo tra tra');
      expect(PHRASES).toContain('Panceta panceta panceta panceta');
      expect(PHRASES).toContain('Robo total de verdad que verguenza');
    });
  });

  describe('getAhorcadoRoom', () => {
    it('creates a new room if it does not exist', () => {
      const room = getAhorcadoRoom('teststreamer');
      expect(room).toBeDefined();
      expect(room.drawnLetters).toEqual([]);
      expect(room.misses).toBe(0);
      expect(room.started).toBe(false);
      expect(room.maxMisses).toBe(MAX_MISSES);
    });

    it('returns existing room on second call', () => {
      const room1 = getAhorcadoRoom('teststreamer2');
      const room2 = getAhorcadoRoom('teststreamer2');
      expect(room1).toBe(room2);
    });
  });

  describe('pickPhrase', () => {
    it('returns a phrase from the list', () => {
      expect(PHRASES).toContain(pickPhrase(0));
    });

    it('honors a given index', () => {
      expect(pickPhrase(2)).toBe('Te la dedico Black');
    });

    it('wraps out of range indexes', () => {
      expect(pickPhrase(PHRASES.length)).toBe(PHRASES[0]);
    });
  });

  describe('lettersOf', () => {
    it('returns unique uppercase letters ignoring spaces/punctuation', () => {
      const letters = lettersOf('A una bala');
      expect(letters).toEqual(['A', 'U', 'N', 'B', 'L']);
    });
  });

  describe('drawLetter', () => {
    it('returns a letter from the alphabet', () => {
      const room = getAhorcadoRoom('drawtest');
      room.phrase = pickPhrase(0);
      const l = drawLetter(room);
      expect(ALPHABET).toContain(l);
    });

    it('adds drawn letter to room.drawnLetters', () => {
      const room = getAhorcadoRoom('drawtest2');
      room.phrase = pickPhrase(0);
      const l = drawLetter(room);
      expect(room.drawnLetters).toContain(l);
    });

    it('does not repeat letters', () => {
      const room = getAhorcadoRoom('drawtest3');
      room.phrase = pickPhrase(0);
      for (let i = 0; i < ALPHABET.length; i++) drawLetter(room);
      const unique = new Set(room.drawnLetters);
      expect(unique.size).toBe(ALPHABET.length);
    });

    it('returns null when the whole alphabet has been drawn', () => {
      const room = getAhorcadoRoom('drawtest4');
      room.phrase = pickPhrase(0);
      for (let i = 0; i < ALPHABET.length; i++) drawLetter(room);
      expect(drawLetter(room)).toBeNull();
    });

    it('increments misses for letters not in the phrase', () => {
      const room = getAhorcadoRoom('drawtest5');
      room.phrase = 'MANTI PERRO';
      for (let i = 0; i < ALPHABET.length && !isLost(room); i++) {
        const l = drawLetter(room);
        if (!'MANTIPERO'.includes(l)) {
          expect(room.misses).toBeGreaterThan(0);
          break;
        }
      }
    });
  });

  describe('isComplete', () => {
    it('returns true when all phrase letters are drawn', () => {
      const room = getAhorcadoRoom('completetest');
      room.phrase = 'ALA';
      room.drawnLetters = ['A', 'L'];
      expect(isComplete(room)).toBe(true);
    });

    it('returns false when not all phrase letters are drawn', () => {
      const room = getAhorcadoRoom('completetest2');
      room.phrase = 'ALA';
      room.drawnLetters = ['A'];
      expect(isComplete(room)).toBe(false);
    });

    it('returns false when there is no phrase', () => {
      const room = getAhorcadoRoom('completetest3');
      expect(isComplete(room)).toBe(false);
    });
  });

  describe('isLost', () => {
    it('returns true after max misses', () => {
      const room = getAhorcadoRoom('losttest');
      room.phrase = 'A';
      room.misses = MAX_MISSES;
      expect(isLost(room)).toBe(true);
    });

    it('returns false with fewer misses', () => {
      const room = getAhorcadoRoom('losttest2');
      room.phrase = 'A';
      room.misses = MAX_MISSES - 1;
      expect(isLost(room)).toBe(false);
    });
  });

  describe('normalize', () => {
    it('lowercases, trims and collapses spaces', () => {
      expect(normalize('  Te   la DEDICO  Black ')).toBe('te la dedico black');
    });
  });

  describe('active games', () => {
    it('registers and retrieves an active game by channel', () => {
      setActiveGame('streamer1', 'mantichannel', 'A una bala');
      const game = getActiveGame('MANTIchannel');
      expect(game).not.toBeNull();
      expect(game.streamer).toBe('streamer1');
      expect(game.phrase).toBe('A una bala');
      expect(game.guessed).toBe(false);
    });

    it('returns null when no active game exists', () => {
      expect(getActiveGame('somechannel')).toBeNull();
    });

    it('clears the active game', () => {
      setActiveGame('streamer2', 'chan2', 'Manti perro');
      clearActiveGame('chan2');
      expect(getActiveGame('chan2')).toBeNull();
    });

    it('markGuessed sets guessed on the game and the room', () => {
      setActiveGame('streamer3', 'chan3', 'Manti perro');
      const guessed = markGuessed('chan3');
      expect(guessed).not.toBeNull();
      expect(guessed.guessed).toBe(true);
      expect(getAhorcadoRoom('streamer3').guessed).toBe(true);
    });

    it('markGuessed returns null on a second guess', () => {
      setActiveGame('streamer4', 'chan4', 'Manti perro');
      markGuessed('chan4');
      expect(markGuessed('chan4')).toBeNull();
    });

    it('markGuessed returns null when there is no active game', () => {
      expect(markGuessed('unknown')).toBeNull();
    });
  });

  describe('parseGuess', () => {
    it('extracts the phrase after the command prefix', () => {
      expect(parseGuess('!ahorcado Manti perro')).toBe('manti perro');
    });

    it('returns null for a message without the command', () => {
      expect(parseGuess('Manti perro')).toBeNull();
    });

    it('returns null for an empty command', () => {
      expect(parseGuess('!ahorcado')).toBeNull();
      expect(parseGuess('!ahorcado   ')).toBeNull();
    });
  });

  describe('isSubscriber', () => {
    it('returns true when subscriber tag is 1', () => {
      expect(isSubscriber({ subscriber: '1' })).toBe(true);
    });

    it('returns true when badges include subscriber or founder', () => {
      expect(isSubscriber({ badges: 'subscriber/12' })).toBe(true);
      expect(isSubscriber({ badges: 'founder/0' })).toBe(true);
    });

    it('returns false for non-subs', () => {
      expect(isSubscriber({ badges: 'vip/1' })).toBe(false);
      expect(isSubscriber({})).toBe(false);
      expect(isSubscriber(null)).toBe(false);
    });
  });

  describe('per-player misses', () => {
    it('registers a player and accumulates misses per player', () => {
      const room = getAhorcadoRoom('playertest1');
      room.players = {};
      addPlayerMiss(room, 'alice', 'Alice');
      addPlayerMiss(room, 'alice', 'Alice');
      addPlayerMiss(room, 'bob', 'Bob');
      expect(room.players['alice'].misses).toBe(2);
      expect(room.players['bob'].misses).toBe(1);
      expect(room.players['alice'].username).toBe('Alice');
    });

    it('playerEliminated after MAX_PLAYER_MISSES', () => {
      const room = getAhorcadoRoom('playertest2');
      room.players = {};
      for (let i = 0; i < MAX_PLAYER_MISSES; i++) addPlayerMiss(room, 'alice', 'Alice');
      expect(playerEliminated(room, 'alice')).toBe(true);
    });

    it('registerPlayer keeps existing player state', () => {
      const room = getAhorcadoRoom('playertest3');
      room.players = {};
      registerPlayer(room, 'alice', 'Alice');
      const again = registerPlayer(room, 'alice', 'Alice');
      expect(again.misses).toBe(0);
      expect(Object.keys(room.players)).toHaveLength(1);
    });
  });

  describe('processChatGuess', () => {
    beforeEach(() => {
      setActiveGame('guessstreamer', 'guesschan', 'Manti perro');
    });

    it('adds a miss for a wrong guess', () => {
      const res = processChatGuess('guesschan', 'alice', 'Alice', 'Manti gato', {});
      expect(res.kind).toBe('miss');
      expect(res.channel).toBe('guesschan');
      expect(res.player.name).toBe('Alice');
      expect(res.player.misses).toBe(1);
    });

    it('registers a win for the exact phrase', () => {
      const res = processChatGuess('guesschan', 'alice', 'Alice', 'Manti perro', {});
      expect(res.kind).toBe('win');
      expect(res.channel).toBe('guesschan');
      expect(res.player.name).toBe('Alice');
      expect(res.phrase).toBe('Manti perro');
      expect(getAhorcadoRoom('guessstreamer').guessed).toBe(true);
    });

    it('returns null once the game has been guessed', () => {
      processChatGuess('guesschan', 'alice', 'Alice', 'Manti perro', {});
      expect(processChatGuess('guesschan', 'bob', 'Bob', 'Manti perro', {})).toBeNull();
    });

    it('ignores non-subs when the game is subs-only', () => {
      setActiveGame('guessstreamer2', 'guesschan2', 'Manti perro', true);
      expect(processChatGuess('guesschan2', 'alice', 'Alice', 'Manti perro', { badges: 'vip/1' })).toBeNull();
    });

    it('accepts subs when the game is subs-only', () => {
      setActiveGame('guessstreamer3', 'guesschan3', 'Manti perro', true);
      const res = processChatGuess('guesschan3', 'alice', 'Alice', 'Manti perro', { subscriber: '1' });
      expect(res.kind).toBe('win');
    });

    it('ignores players who reached the miss limit', () => {
      const room = getAhorcadoRoom('guessstreamer');
      room.players['alice'] = { username: 'Alice', misses: MAX_PLAYER_MISSES };
      expect(processChatGuess('guesschan', 'alice', 'Alice', 'Manti perro', {})).toBeNull();
    });

    it('returns null when there is no active game', () => {
      expect(processChatGuess('nope', 'alice', 'Alice', 'Manti perro', {})).toBeNull();
    });
  });
});
