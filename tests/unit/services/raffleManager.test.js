const raffleManager = require('../../../src/services/raffleManager');

describe('raffleManager', () => {
  beforeEach(() => {
    raffleManager.reset({
      active: true,
      selectedStreamer: 'test',
      twitchChannel: 'test',
      game: 'roulette',
      keyword: '!raffle',
      subMult: 2,
      giftMult: 3,
      cachedSubs: new Map(),
    });
  });

  it('adds a unique participant', () => {
    const p1 = raffleManager.addParticipant('alice', 'Alice', null);
    expect(p1).not.toBeNull();
    expect(p1.username).toBe('Alice');
    expect(p1.points).toBe(1);

    const p2 = raffleManager.addParticipant('alice', 'Alice', null);
    expect(p2).toBeNull();
    expect(raffleManager.state.participants.size).toBe(1);
  });

  it('does not add participants when not active', () => {
    raffleManager.state.active = false;
    const p = raffleManager.addParticipant('bob', 'Bob', null);
    expect(p).toBeNull();
  });

  it('calculates points with sub multiplier', () => {
    const userData = { isSub: true, giftsSent: 0 };
    const p = raffleManager.addParticipant('charlie', 'Charlie', userData);
    expect(p.points).toBe(2);
  });

  it('calculates points with gift multiplier', () => {
    const userData = { isSub: false, giftsSent: 5 };
    const p = raffleManager.addParticipant('dave', 'Dave', userData);
    expect(p.points).toBe(1 + 5 * 3);
  });

  it('calculates points with both multipliers', () => {
    const userData = { isSub: true, giftsSent: 2 };
    const p = raffleManager.addParticipant('eve', 'Eve', userData);
    expect(p.points).toBe(2 + 2 * 3);
  });

  it('stop returns sorted participants by points descending', () => {
    raffleManager.addParticipant('alice', 'Alice', { isSub: true, giftsSent: 0 });
    raffleManager.addParticipant('bob', 'Bob', null);

    const result = raffleManager.stop();
    expect(result.length).toBe(2);
    expect(result[0].points).toBeGreaterThanOrEqual(result[1].points);
    expect(raffleManager.state.active).toBe(false);
  });
});
