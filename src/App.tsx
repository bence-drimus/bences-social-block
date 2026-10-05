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

const MODE_LABEL: Record<Modes, string> = {
  none: "Normal",
  blockfull: "Block site",
  whitelist: "Allowlist",
  blacklist: "Blocklist",
};

const MODE_HINT: Record<Modes, string> = {
  none: "Only the switches below apply.",
  // apply() in content.ts returns before any feature runs, so this is literal.
  blockfull: "Blocks the whole site. The switches below are paused.",
  whitelist: "Only these channels show. Your subscriptions are always allowed.",
  blacklist: "Videos from these channels are hidden.",
};

const SITE_LABEL: Record<Site, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  reddit: "Reddit",
};

// ponytail: hand-drawn glyphs, swap in the real brand SVGs if they read badly at 16px
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

function Icon({ name, size }: { name: Panel; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** public/icons/icon.svg, with its colours swapped so it reads on the indigo header. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="mark">
      <rect width="24" height="24" rx="6" className="mark-bg" />
      <g className="mark-fg">
        <rect x="6.6" y="5" width="3.2" height="14" rx="0.6" />
        <path d="M9 5h4.1a3.6 3.6 0 0 1 0 7.2H9z" />
        <path d="M9 11.8h4.6a3.6 3.6 0 0 1 0 7.2H9z" />
      </g>
      <g className="mark-bg">
        <rect x="10.4" y="7" width="4" height="3.2" rx="1.6" />
        <rect x="10.4" y="13.8" width="4.4" height="3.2" rx="1.6" />
      </g>
    </svg>
  );
}

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
    <>
      <form onSubmit={add}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="@channel, URL or name"
          aria-label="Channel to add"
        />
        <button type="submit" className="btn">
          Add
        </button>
      </form>
      {list.length > 0 && (
        <ul className="chips">
          {list.map((channel) => (
            <li key={channel} className="chip">
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
      )}
    </>
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
  // A ticked parent already hides a row, so the row is shown on and locked rather than
  // written to storage - unticking the parent then restores exactly what was set before.
  const covered = (f: Feature) => !!f.parent && disabled.includes(f.parent);
  const on = (f: Feature) => covered(f) || disabled.includes(f.id);

  return (
    <>
      {[...new Set(features.map((f) => f.group))].map((group) => {
        const rows = features.filter((f) => f.group === group);
        return (
          <section key={group}>
            <h2 className="label">
              {group}
              <span className="count">
                {rows.filter(on).length}/{rows.length}
              </span>
            </h2>
            <div className="group">
              {rows.map((feature) => (
                <label
                  key={feature.id}
                  className={feature.parent ? "row child" : "row"}
                >
                  <span>{feature.label}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="switch"
                    checked={on(feature)}
                    disabled={covered(feature)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...disabled, feature.id]
                          : disabled.filter((id) => id !== feature.id),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        );
      })}
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
function PresetCard({
  preset,
  onImport,
}: {
  preset: Preset;
  onImport: (sites: Site[]) => void;
}) {
  const covered = Object.keys(preset.sites) as Site[];
  // null while the card is idle, a (possibly empty) selection while it is asking.
  const [picked, setPicked] = useState<Site[] | null>(null);

  return (
    <div className="group card">
      <div className="card-head">
        <div>
          <strong>{preset.name}</strong>
          <p className="hint">{preset.description}</p>
        </div>
        {!picked && (
          <button type="button" className="btn" onClick={() => setPicked(covered)}>
            Apply
          </button>
        )}
      </div>

      {picked && (
        <>
          <div className="chips">
            {covered.map((site) => (
              <button
                key={site}
                type="button"
                className="chip toggle"
                aria-pressed={picked.includes(site)}
                onClick={() =>
                  setPicked(
                    picked.includes(site)
                      ? picked.filter((s) => s !== site)
                      : [...picked, site],
                  )
                }
              >
                {SITE_LABEL[site]}
              </button>
            ))}
          </div>
          <p className="hint">Replaces everything set for the sites you pick.</p>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => setPicked(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={picked.length === 0}
              onClick={() => {
                onImport(picked);
                setPicked(null);
              }}
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SettingsPanel({
  replaceSites,
}: {
  replaceSites: (patch: Partial<SiteSettings>) => void;
}) {
  return (
    <>
      <h2 className="label">Presets</h2>
      {PRESETS.map((preset) => (
        <PresetCard
          key={preset.name}
          preset={preset}
          onImport={(chosen) =>
            replaceSites(
              Object.fromEntries(
                chosen.map((site) => [site, preset.sites[site]]),
              ) as Partial<SiteSettings>,
            )
          }
        />
      ))}
      <p className="hint">Pick a site above to set it up yourself.</p>
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
  const hasFeatures = FEATURES[site].length > 0;

  return (
    <>
      <h2 className="label">Mode</h2>
      <div className="group pad">
        <div className="seg" role="radiogroup" aria-label="Mode">
          {MODES[site].map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => update(site, { mode: m })}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="hint">
          {!hasFeatures && mode === "none"
            ? `${SITE_LABEL[site]} has no switches yet, so Normal changes nothing.`
            : MODE_HINT[mode]}
        </p>
        {site === "youtube" && filtering && (
          <ChannelList
            list={sites.youtube.list}
            onChange={(next) => update("youtube", { list: next })}
          />
        )}
      </div>

      {hasFeatures && (
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

  return (
    <div className="popup">
      <header>
        <div className="title">
          <Mark />
          <span>Social Block</span>
          <button
            type="button"
            className="gear"
            aria-label="Settings"
            aria-pressed={active === "settings"}
            onClick={() => setActive("settings")}
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
        <nav>
          {(Object.keys(SITE_LABEL) as Site[]).map((site) => (
            <button
              key={site}
              type="button"
              aria-pressed={site === active}
              onClick={() => setActive(site)}
            >
              <Icon name={site} size={16} />
              {SITE_LABEL[site]}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {active === "settings" ? (
          <SettingsPanel replaceSites={replaceSites} />
        ) : (
          <SitePanel site={active} sites={sites} update={update} />
        )}
      </main>
    </div>
  );
}
