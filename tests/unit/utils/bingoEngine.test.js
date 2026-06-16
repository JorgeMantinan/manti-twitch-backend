const { getBingoRoom, drawNumber, checkLine, checkBingo } = require('../../../src/utils/bingoEngine');

describe('bingoEngine', () => {
  describe('getBingoRoom', () => {
    it('creates a new room if it does not exist', () => {
      const room = getBingoRoom('teststreamer');
      expect(room).toBeDefined();
      expect(room.drawn).toEqual([]);
      expect(room.started).toBe(false);
    });

    it('returns existing room on second call', () => {
      const room1 = getBingoRoom('teststreamer2');
      const room2 = getBingoRoom('teststreamer2');
      expect(room1).toBe(room2);
    });
  });

  describe('drawNumber', () => {
    it('returns a number between 1 and 90', () => {
      const room = getBingoRoom('drawtest');
      const n = drawNumber(room);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(90);
    });

    it('adds drawn number to room.drawn', () => {
      const room = getBingoRoom('drawtest2');
      const n = drawNumber(room);
      expect(room.drawn).toContain(n);
    });

    it('returns null when all 90 numbers are drawn', () => {
      const room = getBingoRoom('drawtest3');
      for (let i = 0; i < 90; i++) drawNumber(room);
      expect(drawNumber(room)).toBeNull();
    });

    it('does not repeat numbers', () => {
      const room = getBingoRoom('drawtest4');
      for (let i = 0; i < 90; i++) drawNumber(room);
      const unique = new Set(room.drawn);
      expect(unique.size).toBe(90);
    });
  });

  describe('checkLine', () => {
    it('returns true when a full row is drawn', () => {
      const card = [
        [1, 2, 3, 4, 5, null, null, null, null],
        [null, null, null, null, null, 6, 7, 8, 9],
        [10, 11, 12, 13, 14, null, null, null, null],
      ];
      expect(checkLine(card, [1, 2, 3, 4, 5])).toBe(true);
    });

    it('returns false when no full row is drawn', () => {
      const card = [
        [1, 2, 3, 4, 5, null, null, null, null],
        [null, null, null, null, null, 6, 7, 8, 9],
        [10, 11, 12, 13, 14, null, null, null, null],
      ];
      expect(checkLine(card, [1, 2, 3, 4])).toBe(false);
    });
  });

  describe('checkBingo', () => {
    it('returns true when all 15 numbers are drawn', () => {
      const card = [
        [1, 2, 3, 4, 5, null, null, null, null],
        [null, null, null, null, null, 6, 7, 8, 9],
        [10, 11, 12, 13, 14, 15, null, null, null],
      ];
      expect(checkBingo(card, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toBe(true);
    });

    it('returns false when fewer than 15 numbers are drawn', () => {
      const card = [
        [1, 2, 3, 4, 5, null, null, null, null],
        [null, null, null, null, null, 6, 7, 8, 9],
        [10, 11, 12, 13, 14, 15, null, null, null],
      ];
      expect(checkBingo(card, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(false);
    });
  });
});
