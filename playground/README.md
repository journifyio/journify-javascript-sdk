# Journify SDK Playground

Internal dev app for testing the SDK while developing it. Imports the SDK
straight from `../src/lib/index.ts` (see the alias in `vite.config.ts`), so any
edit to SDK source hot-reloads the page instantly — no build step.

## Run

```sh
# from the repo root
npm run playground

# or from this directory
npm install
npm run dev
```

## Features

- **SDK settings form** covering every `SdkSettings` option. State is persisted
  to localStorage, so settings survive reloads.
- **Auto-load**: when enabled (default), the SDK is loaded with the saved
  settings on every page load — edit SDK code, page reloads, SDK re-initializes.
- **Fake write-key settings**: the Vite dev server serves
  `GET /write_keys/<any-key>.json` from
  [`fixtures/write-key-settings.json`](fixtures/write-key-settings.json).
  Keep the CDN host on the local origin (default) to use it. Edit the fixture to
  change syncs/plugins — it is re-read on every request. Point the CDN host at a
  real CDN to test real write keys instead.
- **Event buttons**: identify + GA4 recommended e-commerce events (page,
  view_item, add_to_cart, begin_checkout, purchase) with editable, persisted
  payloads. `purchase` gets a fresh `transaction_id` on every click.
- **Consent panel**: calls `updateConsent` with per-category preferences.
- **Log panel**: SDK call log + which syncs were served. Wire-level inspection
  stays in the browser devtools network tab.

Events are sent to the API host selected in the form (default
`https://t.lvh.me`, i.e. your local backend).
