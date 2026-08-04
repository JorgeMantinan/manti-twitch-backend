const {
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
});
