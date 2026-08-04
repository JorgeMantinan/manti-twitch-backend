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
});
