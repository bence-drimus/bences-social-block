import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { FEATURES } from "./features";
import type { Feature } from "./features";
import { useSettings } from "./hooks/useSettings";
import { normaliseChannel, siteFromUrl } from "./match";
import { PRESETS } from "./presets";
import type { Preset } from "./presets";
import type { Modes, Site, SiteSettings } from "./types";

/** The settings page is a nav entry like a site, and the fallback when no site matches. */
type Panel = Site | "settings";

// Whitelist and blacklist are channel comparisons, so only YouTube has anything to
// compare against. The others would be dead settings.
const MODES: Record<Site, Modes[]> = {
  youtube: ["none", "blockfull", "whitelist", "blacklist"],
  facebook: ["none", "blockfull"],
  reddit: ["none", "blockfull"],
};

// ponytail: hand-drawn glyphs, swap in the real brand SVGs if they read badly at 22px
const ICONS: Record<Panel, ReactNode> = {
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6" />
      <path d="M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9" />
    </>
  ),
  reddit: (
    <>
      <circle cx="12" cy="14.5" r="6.5" />
      <circle cx="5.5" cy="11.5" r="2" />
      <circle cx="18.5" cy="11.5" r="2" />
      <path d="M12 8l3.5-4" />
      <path d="M9 17.5c1.8 1.2 4.2 1.2 6 0" />
      <circle cx="16.5" cy="3.5" r="1.5" className="solid" />
      <circle cx="9.8" cy="14" r="1.1" className="solid" />
      <circle cx="14.2" cy="14" r="1.1" className="solid" />
    </>
  ),
  youtube: (
    <>
      <rect x="1.5" y="5" width="21" height="14" rx="4" />
      <path d="M10 9l6 3-6 3z" className="solid" />
    </>
  ),
  facebook: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M15.5 8h-2a2 2 0 00-2 2v11" />
      <path d="M9 13h5.5" />
    </>
  ),
};

function ChannelList({
  list,
  onChange,
}: {
  list: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(e: FormEvent) {
    e.preventDefault();
    const key = normaliseChannel(draft);
    const duplicate = list.some((c) => normaliseChannel(c) === key);
    if (key && !duplicate) onChange([...list, draft.trim()]);
    setDraft("");
  }

  return (
    <fieldset>
      <legend>Channels</legend>
      <form onSubmit={add}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="@channel, URL or name"
          aria-label="Channel to add"
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {list.map((channel) => (
          <li key={channel}>
            <span>{channel}</span>
            <button
              type="button"
              aria-label={`Remove ${channel}`}
              onClick={() => onChange(list.filter((c) => c !== channel))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function FeatureToggles({
  features,
  disabled,
  onChange,
}: {
  features: Feature[];
  disabled: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <>
      {[...new Set(features.map((f) => f.group))].map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {features
            .filter((f) => f.group === group)
            .map((feature) => {
              // A ticked parent already hides this, so the row is shown on and locked
              // rather than written to storage - unticking the parent then restores
              // exactly what was set before.
              const covered =
                !!feature.parent && disabled.includes(feature.parent);
              return (
                <label
                  key={feature.id}
                  className={feature.parent ? "child" : undefined}
                >
                  <input
                    type="checkbox"
                    checked={covered || disabled.includes(feature.id)}
                    disabled={covered}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...disabled, feature.id]
                          : disabled.filter((id) => id !== feature.id),
                      )
                    }
                  />
                  {feature.label}
                </label>
              );
            })}
        </fieldset>
      ))}
    </>
  );
}

/** The panel to open on: the site whose tab is in front, else the settings page. */
function useActivePanel() {
  const [panel, setPanel] = useState<Panel>("settings");

  useEffect(() => {
    // activeTab makes the url readable, but only from the click that opened this popup, so
    // read it once here. Everything about this is best-effort: no url means an internal
    // page, and no chrome.tabs at all means the permission was never granted. Both stay on
    // settings. Guarded because a throw in an effect unmounts the whole popup, which
    // presents as a toolbar icon that does nothing when clicked.
    try {
      chrome.tabs?.query({ active: true, currentWindow: true }, ([tab]) =>
        setPanel((current) => siteFromUrl(tab?.url) ?? current),
      );
    } catch {
      // no tabs access - the settings panel is the right place to land anyway
    }
  }, []);

  return [panel, setPanel] as const;
}

/**
 * Importing throws away what is already set, so it asks which sites first. Two steps
 * rather than window.confirm, which a browser is free to dismiss along with the popup.
 */
function PresetImport({
  preset,
  onImport,
}: {
  preset: Preset;
  onImport: (sites: Site[]) => void;
}) {
  const covered = Object.keys(preset.sites) as Site[];
  // null while the button is idle, a (possibly empty) selection while it is asking.
  const [picked, setPicked] = useState<Site[] | null>(null);

  if (!picked)
    return (
      <button
        type="button"
        className="preset"
        onClick={() => setPicked(covered)}
      >
        Import {preset.name}
      </button>
    );

  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={picked.length === covered.length}
          onChange={(e) => setPicked(e.target.checked ? covered : [])}
        />
        All
      </label>
      {covered.map((site) => (
        <label key={site} className="child">
          <input
            type="checkbox"
            checked={picked.includes(site)}
            onChange={(e) =>
              setPicked(
                e.target.checked
                  ? [...picked, site]
                  : picked.filter((s) => s !== site),
              )
            }
          />
          <span className="cap">{site}</span>
        </label>
      ))}
      <p className="hint">Replaces everything set for the sites you pick.</p>
      <button
        type="button"
        className="preset"
        disabled={picked.length === 0}
        onClick={() => {
          onImport(picked);
          setPicked(null);
        }}
      >
        Import
      </button>
      <button type="button" className="preset" onClick={() => setPicked(null)}>
        Cancel
      </button>
    </>
  );
}

function SettingsPanel({
  replaceSites,
}: {
  replaceSites: (patch: Partial<SiteSettings>) => void;
}) {
  return (
    <>
      <h1>Settings</h1>
      <p className="hint">
        Ready-made configurations. Pick a site on the left to set one up
        yourself.
      </p>
      {PRESETS.map((preset) => (
        <fieldset key={preset.name}>
          <legend>{preset.name}</legend>
          <PresetImport
            preset={preset}
            onImport={(chosen) =>
              replaceSites(
                Object.fromEntries(
                  chosen.map((site) => [site, preset.sites[site]]),
                ) as Partial<SiteSettings>,
              )
            }
          />
        </fieldset>
      ))}
    </>
  );
}

function SitePanel({
  site,
  sites,
  update,
}: {
  site: Site;
  sites: SiteSettings;
  update: <S extends Site>(site: S, patch: Partial<SiteSettings[S]>) => void;
}) {
  const { mode } = sites[site];
  const filtering = mode === "whitelist" || mode === "blacklist";

  return (
    <>
      <h1>{site}</h1>

      {FEATURES[site].length === 0 && (
        <p className="hint">
          <span className="cap">{site}</span> is not supported yet - the mode
          below has no effect.
        </p>
      )}

      <label>
        Mode
        <select
          value={mode}
          onChange={(e) => update(site, { mode: e.target.value as Modes })}
        >
          {MODES[site].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      {site === "youtube" && filtering && (
        <>
          <ChannelList
            list={sites.youtube.list}
            onChange={(next) => update("youtube", { list: next })}
          />
          {mode === "whitelist" && (
            <p className="hint">Your subscriptions are always allowed.</p>
          )}
        </>
      )}

      {FEATURES[site].length > 0 && (
        <FeatureToggles
          features={FEATURES[site]}
          disabled={sites[site].disabled ?? []}
          onChange={(next) => update(site, { disabled: next })}
        />
      )}
    </>
  );
}

export default function App() {
  const { sites, update, replaceSites } = useSettings();
  const [active, setActive] = useActivePanel();
  if (!sites) return null;

  const panels: Panel[] = ["settings", ...(Object.keys(sites) as Site[])];

  return (
    <div className="popup">
      <nav>
        {panels.map((panel) => (
          <button
            key={panel}
            type="button"
            aria-label={panel}
            aria-pressed={panel === active}
            onClick={() => setActive(panel)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {ICONS[panel]}
            </svg>
          </button>
        ))}
      </nav>

      <section>
        {active === "settings" ? (
          <SettingsPanel replaceSites={replaceSites} />
        ) : (
          <SitePanel site={active} sites={sites} update={update} />
        )}
      </section>
    </div>
  );
}
