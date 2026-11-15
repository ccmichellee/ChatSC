import { useEffect, useRef, useState } from "react";
import { Eye, RotateCcw, X } from "lucide-react";

type TextSize = "default" | "large" | "largest";

type AccessibilityPreferences = {
  textSize: TextSize;
  highContrast: boolean;
  underlineLinks: boolean;
  reduceMotion: boolean;
};

const STORAGE_KEY = "chatsc.accessibility.preferences";
const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  textSize: "default",
  highContrast: false,
  underlineLinks: false,
  reduceMotion: false,
};

function readPreferences(): AccessibilityPreferences {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PREFERENCES;

    const value = JSON.parse(saved) as Partial<AccessibilityPreferences>;
    return {
      textSize: value.textSize === "large" || value.textSize === "largest" ? value.textSize : "default",
      highContrast: value.highContrast === true,
      underlineLinks: value.underlineLinks === true,
      reduceMotion: value.reduceMotion === true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function AccessibilityWidget() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(readPreferences);
  const [open, setOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.a11yTextSize = preferences.textSize;
    root.dataset.a11yHighContrast = String(preferences.highContrast);
    root.dataset.a11yUnderlineLinks = String(preferences.underlineLinks);
    root.dataset.a11yReduceMotion = String(preferences.reduceMotion);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [preferences]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const updatePreference = <K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K],
  ) => setPreferences((current) => ({ ...current, [key]: value }));

  return (
    <div ref={rootRef} className="a11y-widget" data-testid="accessibility-widget">
      <button
        ref={triggerRef}
        type="button"
        className="a11y-widget-trigger"
        aria-label="Accessibility settings"
        aria-controls="accessibility-settings-panel"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        data-testid="button-accessibility"
      >
        <Eye size={19} aria-hidden="true" />
        <span>Accessibility</span>
      </button>

      <section
        id="accessibility-settings-panel"
        className="a11y-widget-panel"
        aria-labelledby="accessibility-settings-title"
        hidden={!open}
        data-testid="panel-accessibility"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="accessibility-settings-title" className="font-display text-lg font-bold">Accessibility settings</h2>
            <p className="text-xs text-muted-foreground mt-1">Display preferences saved on this device.</p>
          </div>
          <button
            type="button"
            className="a11y-widget-icon-button"
            aria-label="Close accessibility settings"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            data-testid="button-close-accessibility"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold mb-2">Text size</legend>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["default", "Default"],
              ["large", "Large"],
              ["largest", "Largest"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="a11y-widget-choice"
                aria-pressed={preferences.textSize === value}
                onClick={() => updatePreference("textSize", value)}
                data-testid={`button-text-size-${value}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4 grid gap-3">
          <legend className="text-sm font-semibold mb-1">Visual options</legend>
          <label className="a11y-widget-toggle">
            <input
              type="checkbox"
              checked={preferences.highContrast}
              onChange={(event) => updatePreference("highContrast", event.target.checked)}
              data-testid="toggle-high-contrast"
            />
            <span>Higher contrast</span>
          </label>
          <label className="a11y-widget-toggle">
            <input
              type="checkbox"
              checked={preferences.underlineLinks}
              onChange={(event) => updatePreference("underlineLinks", event.target.checked)}
              data-testid="toggle-underline-links"
            />
            <span>Underline links</span>
          </label>
          <label className="a11y-widget-toggle">
            <input
              type="checkbox"
              checked={preferences.reduceMotion}
              onChange={(event) => updatePreference("reduceMotion", event.target.checked)}
              data-testid="toggle-reduce-motion"
            />
            <span>Reduce motion</span>
          </label>
        </fieldset>

        {storageError && (
          <p role="status" className="text-xs text-destructive mt-3">
            These settings could not be saved in this browser.
          </p>
        )}

        <button
          type="button"
          className="a11y-widget-reset mt-4"
          onClick={() => setPreferences(DEFAULT_PREFERENCES)}
          data-testid="button-reset-accessibility"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Reset settings
        </button>
      </section>
    </div>
  );
}
