import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { FEATURES } from "./features";
import type { Feature } from "./features";
import { useSettings } from "./hooks/useSettings";
import { normaliseChannel, siteFromHostname } from "./match";
import type { Modes, Site, SiteSettings } from "./types";

// Whitelist and blacklist are channel comparisons, so only YouTube has anything to
// compare against. The others would be dead settings.
const MODES: Record<Site, Modes[]> = {
  youtube: ["none", "blockfull", "whitelist", "blacklist"],
  facebook: ["none", "blockfull"],
  reddit: ["none", "blockfull"],
};

// ponytail: hand-drawn glyphs, swap in the real brand SVGs if they read badly at 22px
const ICONS: Record<Site, ReactNode> = {
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

/** The site whose tab is in front, or null when the user is somewhere else entirely. */
function useActiveSite() {
  const [site, setSite] = useState<Site | null>(null);

  useEffect(() => {
    // activeTab makes the url readable, but only from the click that opened this popup, so
    // read it once here. No url means no permission or an internal page: leave it unset.
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.url) return;
      setSite(siteFromHostname(new URL(tab.url).hostname));
    });
  }, []);

  return [site, setSite] as const;
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
  const { sites, update } = useSettings();
  const [active, setActive] = useActiveSite();
  if (!sites) return null;

  return (
    <div className="popup">
      <nav>
        {(Object.keys(sites) as Site[]).map((site) => (
          <button
            key={site}
            type="button"
            aria-label={site}
            aria-pressed={site === active}
            onClick={() => setActive(site)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {ICONS[site]}
            </svg>
          </button>
        ))}
      </nav>

      <section>
        {active ? (
          <SitePanel site={active} sites={sites} update={update} />
        ) : (
          <p className="hint">Pick a site, or open one in this tab.</p>
        )}
      </section>
    </div>
  );
}
