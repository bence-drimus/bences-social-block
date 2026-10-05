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

// Brand marks are Simple Icons (CC0), the gear is Lucide's (ISC). Single colour on purpose:
// brand colours would fight the indigo header.
const ICONS: Record<Panel, ReactNode> = {
  settings: (
    <>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  reddit: (
    <path
      className="solid"
      d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"
    />
  ),
  youtube: (
    <path
      className="solid"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
    />
  ),
  facebook: (
    <path
      className="solid"
      d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
    />
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
