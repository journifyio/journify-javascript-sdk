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

## Using in html page
Add the following script tag at the top of your `<head>`:

```html

<script>
    !(function () {var journify = (window.journify = window.journify || []);var localJournify; if (!journify.load) { if (journify.invoked) { console.error("Journify snippet included twice."); } else { journify.invoked = !0; journify.methods = ["track", "identify", "group", "track", "page"]; journify.factory = function (methodName) { return function () { var callArgs = Array.prototype.slice.call(arguments); callArgs.unshift(methodName); journify.push(callArgs); return journify }; }; for (var i = 0; i < journify.methods.length; i++) { var methodName = journify.methods[i]; journify[methodName] = journify.factory(methodName); } journify.load = function (loadSettings) { var script = document.createElement("script"); script.type = "text/javascript"; script.async = !0; script.src = "https://unpkg.com/@journifyio/js-sdk@latest/dist/_bundles/journifyio.min.js"; localJournify = journify; script.onload = function () { window.journify.load(loadSettings); for (var i = 0; i < localJournify.length; i++) { var callArgs = localJournify[i]; var methodName = callArgs.shift(); if (!window.journify[methodName]) return; window.journify[methodName].apply(this, callArgs); } }; var firstScript = document.getElementsByTagName("script")[0]; firstScript.parentNode.insertBefore(script, firstScript); };
        journify.load({ writeKey: "<YOUR_WRITE_KEY>" });
        Journify.identify('user-id-1', {email: "user-1@mail.com"}, { id: "001-541-754-3010", type: "phone", collection: "users"})
        journify.page();
        journify.track('Order completed', {
            email: "user-1@mail.com",
            value: 1000,
        })
    }}})();
</script>
```

# Contributing
You can contribute to Journify JavaScript SDK by forking the repo and making pull requests on the `main` branch.

To publish a new version, you need to add a prefix to your pull request title following the [semantic versioning spec](https://semver.org/):
* **[MAJOR]** \{Pull request title\}
* **[MINOR]** \{Pull request title\}
* **[PATCH]** \{Pull request title\}

Once your PR is merged and the CI pipeline is passed, your code will be published to npm.