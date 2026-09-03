# Social Block

Browser extension that filters YouTube by channel, so you can keep the site for work
without the feed pulling you elsewhere.

Pick a mode per site from the popup:

- `none` leaves the site alone
- `whitelist` hides video tiles from any channel not on your list
- `blacklist` hides video tiles from the channels on your list
- `blockfull` blocks the whole site

In whitelist mode your subscriptions are allowed automatically and are not shown in the
list.

Channels can be added as a handle (`@mkbhd`), a URL, or the display name. Opening a video
whose channel is filtered out bounces you back to the previous page.

Facebook has its own toggles: the post composer, Stories, Reels in the feed and People
you may know under Hide content; Home, Reels, Groups, Gaming, Friends, Memories, Saved and Marketplace under
Block pages; Meta AI, Your shortcuts, Notifications, Messenger, the Facebook menu, the
contacts sidebar and the whole left sidebar under Hide interface. Ticking a page also
removes its entry from the left rail. Groups blocks the browse pages only, so
an individual group you joined stays readable. Its modes are `none` and `blockfull` - the
other two filter by channel, which Facebook has no equivalent of yet.

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
