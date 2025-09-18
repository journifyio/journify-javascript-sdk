# HTTP Cookie Service

## Server Side Setup

To implement the HTTP Cookie Service, ensure your setup is served from the same IP as your main HTML document. Follow one of the provided examples to see how it can be implemented. Here is a placeholder snippet for your reference:

Python example:
```
USER_COOKIE = "journifyio_user_id"
ANON_COOKIE = "journifyio_anonymous_id"
ONE_YEAR = 60*60*24*365*2


def get_domain():
    domain = os.getenv("DOMAIN") or request.headers.get("host") or request.headers.get("x-forwarded-for")
    if domain.startswith("localhost"):
        return "localhost"
    return domain

def renew_cookie(res, browserName, serverName):
    browserCookie = request.cookies.get(browserName)
    serverCookie = request.cookies.get(serverName)
    cookie = serverCookie or browserCookie  or ""

    domain = get_domain()

    res.set_cookie(browserName, value=cookie, samesite="Lax", max_age=ONE_YEAR, domain=domain)
    res.set_cookie(serverName, value=cookie, httponly=True, samesite="Lax", max_age=ONE_YEAR, domain=domain)

    return cookie

@app.route('/jrf/renew', methods=['POST'])
def renew():
    res = jsonify()
    journifyio_anonymous_id = renew_cookie(res, ANON_COOKIE, ANON_COOKIE + "_srvr")
    journifyio_user_id = renew_cookie(res, USER_COOKIE, USER_COOKIE + "_srvr")
    data = {
        "journifyio_anonymous_id": journifyio_anonymous_id,
        "journifyio_user_id": journifyio_user_id
    }
    res.set_data(json.dumps(data))
    return res
```


### Javascript SDK Setup
Once your server-side setup is complete and the HTTP Cookie Service endpoints are reachable, update your JavaScript SDK snippet to use the new HTTP Cookie Service options.

```

    <script>
    !(function () {var journify = (window.journify = window.journify || []);var localJournify; if (!journify.load) { if (journify.invoked) { console.error("Journify snippet included twice."); } else { journify.invoked = !0; journify.methods = ["track", "identify", "group", "track", "page"]; journify.factory = function (methodName) { return function () { var callArgs = Array.prototype.slice.call(arguments); callArgs.unshift(methodName); journify.push(callArgs); return journify }; }; for (var i = 0; i < journify.methods.length; i++) { var methodName = journify.methods[i]; journify[methodName] = journify.factory(methodName); } journify.load = function (loadSettings) { var script = document.createElement("script"); script.type = "text/javascript"; script.async = !0; script.src = "https://static.journify.dev/@journifyio/js-sdk@latest/journifyio.min.js"; localJournify = journify; script.onload = function () { window.journify.load(loadSettings); for (var i = 0; i < localJournify.length; i++) { var callArgs = localJournify[i]; var methodName = callArgs.shift(); if (!window.journify[methodName]) return; window.journify[methodName].apply(this, callArgs); } }; var firstScript = document.getElementsByTagName("script")[0]; firstScript.parentNode.insertBefore(script, firstScript); };
        journify.load({ 
            writeKey: "<YOUR_WRITE_KEY>",
            cdnHost: "https://static.journify.dev",
            apiHost: "https://t.journify.dev",
            httpCookieServiceOptions: {
                renewUrl: "/jrf/renew",
            }
        });
        journify.page();
    }}})();
    </script>

```

#### Options

You can adjust these options:

| name     | type   | required | default |
|----------|--------|----------|---------|
| renewUrl | string | yes      |         |
| clearUrl | string | yes      |         |
| timeout  | number | no       | 1000    |
| retries  | number | no       | 2       |