# Journify JavaScript SDK
This SDK enables you to send your data to Journify back-office without any additional integrations for new added destinations.

# Quickstart
The easiest and quickest way to get started with the SDK is to [use it through Journify](#using-with-journify). Alternatively, you can [install it through NPM](#using-as-an-npm-package) or simply [add it to your HTML page](#using-in-html-page) and do the instrumentation yourself.

## Using with Journify
1. Create a javascript source at [Journify](https://app.journify.io) and you will automatically get a snippet that you can add to your website. For more information visit our [documentation](https://docs.journify.io/sources/javascript-sdk).
2. Start tracking!

## Using as an NPM package
1. Install the package

```sh
# npm
npm install @journifyio/js-sdk

# yarn
yarn add @journifyio/js-sdk

# pnpm
pnpm add @journifyio/js-sdk
```

2. Import the package into your project and you're good to go (with working types)!

```ts
import * as Journify from "@journifyio/js-sdk";

Journify.load({ writeKey: '<YOUR_WRITE_KEY>' })

Journify.identify('user-id-1', {email: "user-1@mail.com"})

document.body?.addEventListener('click', () => {
    Journify.track('document body clicked!')
})
```

## Remote configuration
The SDK now resolves selected runtime options from the write-key settings payload fetched from:

`https://static.journify.io/write_keys/{write_key}.json`

The request reuses the existing write-key settings fetch, including custom `cdnHost` support. The SDK reads the top-level `addons` array, normalizes it into internal options, and resolves each supported AddOn with this precedence:

1. Remote dashboard AddOn configuration from `addons`
2. Legacy local SDK options passed to `load(...)`
3. SDK safe defaults

If the remote request fails, times out, returns malformed JSON, or omits an option, the SDK continues initializing with local configuration and defaults. Successful write-key responses are cached for the lifetime of the page and concurrent loads for the same URL are deduplicated.

Presence in `addons` means the AddOn is enabled automatically. A remote `enabled` key is not required.

Example payload:

```json
{
  "consent_mode": "relaxed",
  "syncs": [],
  "addons": [
    {
      "name": "hashing",
      "options": {
        "algorithm": "sha256"
      }
    },
    {
      "name": "auto_capture_pii",
      "options": {
        "fields": ["email", "phone"]
      }
    }
  ]
}
```

Example SDK initialization:

```ts
import * as Journify from "@journifyio/js-sdk";

Journify.load({
  writeKey: "<YOUR_WRITE_KEY>",
  options: {
    enableHashing: true,
    autoCapturePII: true,
    additionalPIIKeys: ["address"],
  },
});
```

In the example above, the dashboard `hashing` and `auto_capture_pii` AddOns win because remote configuration overrides the legacy local options when those AddOns are present.

### Supported remote AddOns
- `hashing`
  Remote shape:
  ```json
  {
    "addons": [
      {
        "name": "hashing",
        "options": {
        "algorithm": "sha256"
      }
      }
    ]
  }
  ```
  Notes: only `sha256` is supported. If the AddOn is present and the algorithm is missing or invalid, the SDK safely falls back to `sha256`.

- `auto_capture_pii`
  Remote shape:
  ```json
  {
    "addons": [
      {
        "name": "auto_capture_pii",
        "options": {
        "fields": ["email", "phone"]
      }
      }
    ]
  }
  ```
  Notes: if the AddOn is present and `fields` is missing or empty, the SDK uses its built-in supported field set.

- `cookie_keeper`
  Remote shape:
  ```json
  {
    "addons": [
      {
        "name": "cookie_keeper"
      }
    ]
  }
  ```
  Notes: the legacy local `renewUrl` inside `httpCookieServiceOptions` is still required to power cookie renewal. If the dashboard includes `cookie_keeper` without a valid local `renewUrl`, the SDK disables the feature safely and logs a warning.

### Legacy local options
The following `load(...).options` fields are still supported for backward compatibility, but should now be treated as legacy:

- `enableHashing`
- `additionalPIIKeys`
- `autoCapturePII`
- `httpCookieServiceOptions`

When both a remote AddOn and its matching legacy local option are present, the SDK logs a warning and the remote configuration wins.

### Migration note
Existing integrations do not need to change immediately. To migrate toward dashboard-controlled configuration:

- Move `enableHashing` to the dashboard `hashing` AddOn
- Keep `additionalPIIKeys` locally until the dashboard supports supplemental hashing field lists
- Move `autoCapturePII` to the dashboard `auto_capture_pii` AddOn
- Move cookie keeper enablement to the dashboard `cookie_keeper` AddOn, while continuing to provide the local `httpCookieServiceOptions.renewUrl`

Legacy local options remain supported in this release as a fallback and compatibility layer.

## Using in html page
Add the following script tag at the top of your `<head>`. Replace `<YOUR_WRITE_KEY>` with your actual write key.

```html

<script>
    !(function () {var journify = (window.journify = window.journify || []);var localJournify; if (!journify.load) { if (journify.invoked) { console.error("Journify snippet included twice."); } else { journify.invoked = !0; journify.methods = ["track", "identify", "group", "track", "page"]; journify.factory = function (methodName) { return function () { var callArgs = Array.prototype.slice.call(arguments); callArgs.unshift(methodName); journify.push(callArgs); return journify }; }; for (var i = 0; i < journify.methods.length; i++) { var methodName = journify.methods[i]; journify[methodName] = journify.factory(methodName); } journify.load = function (loadSettings) { var script = document.createElement("script"); script.type = "text/javascript"; script.async = !0; script.src = "https://unpkg.com/@journifyio/js-sdk@latest/dist/_bundles/journifyio.min.js"; localJournify = journify; script.onload = function () { window.journify.load(loadSettings); for (var i = 0; i < localJournify.length; i++) { var callArgs = localJournify[i]; var methodName = callArgs.shift(); if (!window.journify[methodName]) return; window.journify[methodName].apply(this, callArgs); } }; var firstScript = document.getElementsByTagName("script")[0]; firstScript.parentNode.insertBefore(script, firstScript); };

        journify.load({ writeKey: "<YOUR_WRITE_KEY>" });
    }}})();
</script>
```
### Usage
```html
<script>
  // Identify a user
  journify.identify(
    "user-id-1",
    { email: "user-1@mail.com" },
  );

  // Track a page view
  journify.page();

  // Track an event
  journify.track("purchase", {
    value: 1000,
    currency: "SAR",
    transaction_id: "1000-abe7f-842537-1372826"
  });
</script>
```

# Contributing
You can contribute to Journify JavaScript SDK by forking the repo and making pull requests on the `main` branch.

To publish a new version, you need to add a prefix to your pull request title following the [semantic versioning spec](https://semver.org/):
* **[MAJOR]** \{Pull request title\}
* **[MINOR]** \{Pull request title\}
* **[PATCH]** \{Pull request title\}

Once your PR is merged and the CI pipeline is passed, your code will be published to npm.

## Test your changes using the playground
1. Install the playground dependencies (done once)
    ```sh
    cd playground
    npm install
    cd -
    ```
2. Start the playground
    ```sh
    npm run playground
    ```

The playground imports the SDK directly from `src/`, so SDK changes hot-reload
instantly — no build step needed. See [playground/README.md](playground/README.md)
for details (persisted settings, GA4 event buttons).
# License
This project is licensed under MIT license.
