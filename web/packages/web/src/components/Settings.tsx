import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui-shadcn/dialog';
import { THEMES, applyTheme, getCurrentTheme, type ThemeId } from '@/state/theme';

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Settings({ open, onOpenChange }: SettingsProps) {
  const [currentTheme, setCurrentTheme] = React.useState<ThemeId>(getCurrentTheme());

  function handleThemeChange(id: ThemeId) {
    applyTheme(id);
    setCurrentTheme(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Customize your workbench appearance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Theme</p>
            <div className="flex flex-col gap-2">
              {THEMES.map(theme => (
                <label key={theme.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    value={theme.id}
                    checked={currentTheme === theme.id}
                    onChange={() => handleThemeChange(theme.id)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-foreground">{theme.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
