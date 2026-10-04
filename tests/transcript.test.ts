import { describe, it, expect } from 'vitest';
import {
  parseCaptionLines,
  cleanCaptionLines,
  linesToSegments,
  normalizeTranscript,
  rawToSegments,
} from '@/utils/transcript';

describe('parseCaptionLines', () => {
  it('parses bracket timestamps', () => {
    const lines = parseCaptionLines('[00:01] Welcome.\n[00:04] Today we learn APIs.');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ timestamp: '00:01', text: 'Welcome.' });
    expect(lines[1].text).toBe('Today we learn APIs.');
  });

  it('parses bare timestamps', () => {
    const lines = parseCaptionLines('00:08 APIs allow systems to communicate.');
    expect(lines[0].timestamp).toBe('00:08');
  });

  it('supports minutes and hours in timestamps', () => {
    expect(parseCaptionLines('[1:23] hi')[0].timestamp).toBe('1:23');
    expect(parseCaptionLines('[1:02:03] hi')[0].timestamp).toBe('1:02:03');
  });

  it('attaches continuation lines with no timestamp to the previous cue', () => {
    const lines = parseCaptionLines('[00:01] First sentence here.\ncontinuing the thought.');
    expect(lines).toHaveLength(2);
    expect(lines[1].text).toBe('continuing the thought.');
  });

  it('returns empty array for empty input', () => {
    expect(parseCaptionLines('')).toHaveLength(0);
  });

  it('returns empty array for malformed/noise input', () => {
    expect(parseCaptionLines('   \n\n')).toHaveLength(0);
  });
});

describe('cleanCaptionLines', () => {
  it('removes exact duplicate consecutive lines', () => {
    const lines = cleanCaptionLines([
      { timestamp: '00:01', text: 'API' },
      { timestamp: '00:02', text: 'API' },
    ]);
    expect(lines).toHaveLength(1);
  });

  it('removes lines that repeat the previous line entirely', () => {
    const lines = cleanCaptionLines([
      { timestamp: '00:01', text: 'APIs allow systems to communicate.' },
      { timestamp: '00:02', text: 'APIs allow systems to communicate. something' },
    ]);
    expect(lines).toHaveLength(1);
  });

  it('keeps distinct technical lines', () => {
    const lines = cleanCaptionLines([
      { timestamp: '00:01', text: '  APIs   allow systems ' },
      { timestamp: '00:02', text: 'HTTP is a protocol' },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('APIs allow systems');
  });

  it('drops obvious UI noise lines', () => {
    const lines = cleanCaptionLines([
      { timestamp: '', text: '[Music]' },
      { timestamp: '', text: 'www.example.com' },
      { timestamp: '00:01', text: 'Real content' },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['Real content']);
  });

  it('returns empty for an empty malformed list', () => {
    expect(cleanCaptionLines([])).toHaveLength(0);
  });
});

describe('normalizeTranscript', () => {
  it('strips timestamps and produces clean plain text', () => {
    const raw = '[00:01] Welcome to the course.\n[00:04] Today we learn about APIs.\n[00:08] APIs let systems communicate.';
    const normalized = normalizeTranscript(raw);
    expect(normalized).toContain('Welcome to the course.');
    expect(normalized).not.toContain('[00:01]');
    expect(normalized).not.toContain('00:01');
  });
});

describe('linesToSegments / rawToSegments', () => {
  it('preserves source timestamps in internal structure', () => {
    const segments = rawToSegments('[00:08] APIs allow systems to communicate.');
    expect(segments[0]).toEqual({ timestamp: '00:08', text: 'APIs allow systems to communicate.' });
  });

  it('keeps duplicate timestamp info intact after clean', () => {
    const segments = linesToSegments([
      { timestamp: '00:08', text: 'APIs allow systems to communicate.' },
    ]);
    expect(segments[0].timestamp).toBe('00:08');
  });
});
