import { describe, it, expect } from 'vitest';
import { cleanTitle, TITLE_MAX } from '../../src/shelf/title';

describe('cleanTitle', () => {
  it('trims spaces, including full-width ones', () => {
    expect(cleanTitle('  統計学入門　')).toBe('統計学入門');
  });
  it('rejects empty or blank names', () => {
    expect(cleanTitle('')).toBeNull();
    expect(cleanTitle(' 　 ')).toBeNull();
  });
  it('turns line breaks and tabs into single spaces', () => {
    expect(cleanTitle('第1回\n  序論\tと概要')).toBe('第1回 序論 と概要');
  });
  it('cuts names longer than the limit', () => {
    const long = 'あ'.repeat(TITLE_MAX + 10);
    expect(cleanTitle(long)).toBe('あ'.repeat(TITLE_MAX));
    expect(TITLE_MAX).toBe(60);
  });
});
