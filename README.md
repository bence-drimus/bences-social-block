# Social Block

Browser extension that filters YouTube by channel, so you can keep the site for work
without the feed pulling you elsewhere.

Pick a mode per site from the popup:

- `none` leaves the site alone
- `whitelist` hides video tiles from any channel not on your list
- `blacklist` hides video tiles from the channels on your list
- `blockfull` blocks the whole site

Channels can be added as a handle (`@mkbhd`), a URL, or the display name. Opening a video
whose channel is filtered out bounces you back to the previous page.

Reddit is in the popup but does nothing yet, and categories are not implemented.

## Build

    npm install
    npm run build      # tsc, popup bundle, then the content script
    npm run check      # asserts over the channel matching
    npm run lint

Everything lands in `dist/`.

## Load it

Chrome: `chrome://extensions`, turn on Developer mode, Load unpacked, pick `dist`. Hit
reload on the card after each build.

Firefox: `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick
`dist/manifest.json`. It goes away when Firefox restarts. Firefox MV3 does not grant host
permissions at install, so if the filter does nothing, open the extensions panel and allow
the add-on on youtube.com.

## Debugging

Run `__sb()` in the console of a YouTube tab. It prints the current mode, your channel
list, and every tile the filter found with the keys it resolved and whether it was hidden.
A visible tile with `keys: []` means the selectors in `src/content.ts` need updating.
