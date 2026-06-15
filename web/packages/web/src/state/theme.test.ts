import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTheme, loadTheme, getCurrentTheme, THEMES } from './theme';

// Simulate localStorage and document.documentElement in node environment
const mockStorage: Record<string, string> = {};
const mockDataset: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('document', {
  documentElement: {
    dataset: mockDataset,
  },
});

describe('theme', () => {
  beforeEach(() => {
    // Reset mocks
    localStorageMock.clear();
    delete mockDataset['theme'];
  });

  it('applyTheme sets brutal as empty dataset attr', () => {
    applyTheme('brutal');
    expect(mockDataset['theme']).toBe('');
    expect(localStorageMock.getItem('zuzuu:theme')).toBe('brutal');
  });

  it('applyTheme sets light dataset attr', () => {
    applyTheme('light');
    expect(mockDataset['theme']).toBe('light');
    expect(localStorageMock.getItem('zuzuu:theme')).toBe('light');
  });

  it('applyTheme sets soft dataset attr', () => {
    applyTheme('soft');
    expect(mockDataset['theme']).toBe('soft');
    expect(localStorageMock.getItem('zuzuu:theme')).toBe('soft');
  });

  it('loadTheme defaults to brutal when nothing stored', () => {
    loadTheme();
    expect(mockDataset['theme']).toBe('');
    expect(localStorageMock.getItem('zuzuu:theme')).toBe('brutal');
  });

  it('loadTheme restores stored theme', () => {
    localStorageMock.setItem('zuzuu:theme', 'soft');
    loadTheme();
    expect(mockDataset['theme']).toBe('soft');
  });

  it('getCurrentTheme defaults to brutal', () => {
    expect(getCurrentTheme()).toBe('brutal');
  });

  it('getCurrentTheme returns stored theme', () => {
    localStorageMock.setItem('zuzuu:theme', 'light');
    expect(getCurrentTheme()).toBe('light');
  });

  it('THEMES contains all three themes', () => {
    expect(THEMES.map(t => t.id)).toContain('brutal');
    expect(THEMES.map(t => t.id)).toContain('light');
    expect(THEMES.map(t => t.id)).toContain('soft');
  });
});
