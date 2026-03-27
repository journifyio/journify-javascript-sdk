const CONNECTING_PANEL_ID = "journify-debug-connecting-panel";
const CONNECTING_PANEL_OVERLAY_ID = "journify-debug-connecting-overlay";

export function displayConnectingPanelIfSupported() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !document.body ||
    document.getElementById(CONNECTING_PANEL_ID)
  ) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = CONNECTING_PANEL_OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.38)",
    zIndex: "2147483646",
  });

  const panel = document.createElement("div");
  panel.id = CONNECTING_PANEL_ID;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `
    <div style="background:#f1f3f4;border-bottom:1px solid #dadce0;padding:14px 16px 12px;">
      <div style="display:flex;align-items:center;gap:4px;color:#202124;font-family:Arial,sans-serif;font-size:14px;font-weight:500;">
        <span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 auto;">
          <img src="https://www.journify.io/images/Logomark.svg" alt="Journify logo" width="28" height="29" style="display:block;width:28px;height:29px;" />
        </span>
        <span style="font-size:20px;font-weight:bold;">Journify</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;padding:16px 22px 16px;color:#202124;font-family:Arial,sans-serif;font-size:14px;line-height:1.4;">
      <span style="font-weight:bold;">Connecting to Journify ...</span>
    </div>
  `;

  Object.assign(panel.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "460px",
    maxWidth: "calc(100vw - 32px)",
    background: "#ffffff",
    border: "1px solid #dadce0",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(60,64,67,.3),0 4px 8px rgba(60,64,67,.15)",
    zIndex: "2147483647",
    overflow: "hidden",
  });

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
}
