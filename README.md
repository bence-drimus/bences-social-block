# Bence's Social Block

Browser extension that hides or blocks the distracting parts of YouTube and Facebook, so
you can keep using those sites for work or study without the feed pulling you elsewhere.

I wrote it for myself and use it every day. It is published in case it is useful to you
too.

The popup opens on whichever site the current tab is on, and on the settings page anywhere
else. Pick a mode per site:

- `none` leaves the site alone
- `whitelist` hides video tiles from any channel not on your list
- `blacklist` hides video tiles from the channels on your list
- `blockfull` blocks the whole site

In whitelist mode your subscriptions are allowed automatically and are not shown in the
list.

Channels can be added as a handle (`@mkbhd`), a URL, or the display name. Opening a video
whose channel is filtered out bounces you back to the previous page.

Facebook has its own toggles: the post composer, Stories, Reels in the feed and People you
may know under Hide content; Home, Reels, Groups, Gaming, Friends, Memories, Saved and
Marketplace under Block pages; Meta AI, Your shortcuts, Notifications, Messenger, the
Facebook menu, the contacts sidebar and the whole left sidebar under Hide interface. Ticking
a page also removes its entry from the left rail. Groups blocks the browse pages only, so an
individual group you joined stays readable. Its modes are `none` and `blockfull` - the other
two filter by channel, which Facebook has no equivalent of yet.

Reddit is in the popup but does nothing yet, and says so. Categories are not implemented.

## Presets

`src/presets.ts` holds ready-made configurations, offered on the settings page - the first
entry in the popup's icon rail. Importing one asks which of its sites to take, all ticked by
default, and replaces everything set for those. A preset only names the sites it covers, so
the rest are left alone either way.

**Adding a feature to `src/features.ts` means deciding whether it belongs in each preset
too.** An id missing from a preset reads as "leave it enabled", so a preset quietly falls
behind the UI otherwise. `npm run check` catches the opposite mistake - an id in a preset
that no longer exists in `FEATURES`.

## Build

    npm ci
    npm run build      # tsc, popup bundle, then the content script
    npm run check      # asserts over the matching logic and the release metadata
    npm run lint

Everything lands in `dist/`. Built on macOS with Node v25.9.0; `npm run check` relies on
Node's TypeScript type stripping, so Node 22 or newer is required.

`npm run build` runs three steps: `tsc -b` to typecheck, `vite build` for the popup, then
`vite build --config vite.content.config.ts` for the content script. The content script
needs its own lib-mode IIFE build because a manifest content script cannot be an ES module.

Use `npm ci` rather than `npm install`. `dist/assets/index-<hash>.js` is a content hash
referenced by `dist/index.html`, and a different dependency patch changes it, which makes an
otherwise identical build look unreproducible.

## Release

The version lives only in `package.json`. `manifest.json` carries no version key - the vite
plugin splices it in on the way to `dist` - so bumping is one command:

    npm version patch     # edits, commits and tags in one go
    npm run package

`npm run package` refuses to run on a dirty tree, because the source archive comes from
`HEAD` and must match the package being submitted. It writes two files to `release/`:

- `social-block-<version>.zip` - the extension, uploaded to both stores
- `social-block-<version>-sources.zip` - required by AMO, since Vite bundles and minifies

The icons are committed, so no image tooling is needed to build. To regenerate them from
`public/icons/icon.svg`:

    for s in 16 32 48 128; do
      npx -y sharp-cli -i public/icons/icon.svg -o public/icons/icon-$s.png resize $s $s
    done

`npm run check` verifies the committed PNGs are real PNGs of the size their filename
claims, so a botched export fails the build rather than shipping a blurry icon.

## Load it

Chrome: `chrome://extensions`, turn on Developer mode, Load unpacked, pick `dist`. Hit
reload on the card after each build. Chrome logs one "Unrecognized manifest key" warning for
`browser_specific_settings`, which is the Firefox block and is expected.

Firefox: `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick
`dist/manifest.json`. It goes away when Firefox restarts. Firefox 127 is the minimum -
`strict_min_version` says so - both because `:has()` needs 121 and because 127 is where
Firefox started granting MV3 host permissions at install. On older versions the content
script would either crash or never be allowed to run. If site access has been revoked by
hand, re-grant it from the add-on's Permissions tab.

## Debugging

Run `__sb()` in the console of a YouTube or Facebook tab. It prints the current mode, your
channel list, every tile the filter found with the keys it resolved, and `hiding`, which
reports how many elements each disabled feature matched.

The content script runs in an isolated world, so `__sb` is not on the page's own `window` -
set the console's context dropdown (top left of the console, next to the filter) from `top`
to the extension before calling it.

A visible tile with `keys: []` means the tile selectors in `src/content.ts` need updating.
An entry in `__sb().hiding` with `matched: 0` means that feature's selector in
`src/features.ts` found nothing.
