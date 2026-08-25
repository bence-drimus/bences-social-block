import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { FEATURES } from "./features";
import { useSettings } from "./hooks/useSettings";
import { normaliseChannel } from "./match";
import type { Modes, Site } from "./types";

const MODES: Modes[] = ["none", "blockfull", "whitelist", "blacklist"];

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
  disabled,
  onChange,
}: {
  disabled: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <>
      {[...new Set(FEATURES.map((f) => f.group))].map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {FEATURES.filter((f) => f.group === group).map((feature) => (
            <label key={feature.id}>
              <input
                type="checkbox"
                checked={disabled.includes(feature.id)}
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
          ))}
        </fieldset>
      ))}
    </>
  );
}

export default function App() {
  const { sites, update } = useSettings();
  const [active, setActive] = useState<Site>("youtube");
  if (!sites) return null;

  const { mode } = sites[active];
  const filtering = mode === "whitelist" || mode === "blacklist";

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
        <h1>{active}</h1>
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) => update(active, { mode: e.target.value as Modes })}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {active === "youtube" && filtering && (
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

        {active === "youtube" && (
          <FeatureToggles
            disabled={sites.youtube.disabled ?? []}
            onChange={(next) => update("youtube", { disabled: next })}
          />
        )}
      </section>
    </div>
  );
}
