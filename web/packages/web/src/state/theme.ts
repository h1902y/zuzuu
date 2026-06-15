export const THEMES = [
  { id: 'brutal', label: 'Brutal Minimal' },
  { id: 'light', label: 'Light' },
  { id: 'soft', label: 'Soft' },
] as const;

export type ThemeId = typeof THEMES[number]['id'];

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id === 'brutal' ? '' : id;
  localStorage.setItem('zuzuu:theme', id);
}

export function loadTheme(): void {
  const stored = localStorage.getItem('zuzuu:theme') as ThemeId | null;
  const id: ThemeId = stored && THEMES.some(t => t.id === stored) ? stored as ThemeId : 'brutal';
  applyTheme(id);
}

export function getCurrentTheme(): ThemeId {
  const stored = localStorage.getItem('zuzuu:theme') as ThemeId | null;
  return stored && THEMES.some(t => t.id === stored) ? stored as ThemeId : 'brutal';
}
