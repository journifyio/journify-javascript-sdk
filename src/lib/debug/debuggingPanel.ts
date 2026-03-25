type DebugPanelState = "success" | "error";

const DEBUG_PANEL_ID = "journify-debug-panel";
const DEBUG_PANEL_HIGHLIGHT_ID = "journify-debug-panel-highlight";
const DEBUG_PANEL_CLOSE_BUTTON_SELECTOR = "[data-debug-panel-close]";
const DEBUG_PANEL_FINISH_BUTTON_SELECTOR = "[data-debug-panel-finish]";

const SUCCESS_ICON = `
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="10" fill="#1E8E3E"/>
    <path d="M5.5 10.3L8.4 13.2L14.7 6.9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const ERROR_ICON = `
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="10" fill="#D93025"/>
    <path d="M10 5.5V10.25" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <circle cx="10" cy="14" r="1.2" fill="white"/>
  </svg>
`;

const PANEL_MESSAGE: Record<DebugPanelState, string> = {
  success: "Journify source is successfully connected.",
  error: "Your website is connected with a different Journify source. Please make sure you are using the right Production key from the source page.",
};

const PANEL_ICON: Record<DebugPanelState, string> = {
  success: SUCCESS_ICON,
  error: ERROR_ICON,
};

function displayDebugPanelIfNeeded(writeKey: string) {
  // if the panel already displayed, do not display anything
  if (document.getElementById(DEBUG_PANEL_ID)) {
    return;
  }

  const debugState = getDebugPanelState(writeKey);
  if (!debugState) {
    return;
  }

  const pageHighlight = createPageHighlight();
  const panel = createDebuggingPanel(debugState);
  wirePanelHighlightCleanup(panel, pageHighlight);
  document.body?.appendChild(panel);
}

function createDebuggingPanel(
  state: DebugPanelState
): HTMLDivElement {
  const panel = document.createElement("div");
  panel.id = DEBUG_PANEL_ID;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `
    <div style="background:#f1f3f4;border-bottom:1px solid #dadce0;padding:14px 16px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;color:#202124;font-family:Arial,sans-serif;font-size:14px;font-weight:500;">
        <div style="display:flex;align-items:center;gap:4px;min-width:0;">
          <span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 auto;">
            <img src="https://www.journify.io/images/Logomark.svg" alt="Journify logo" width="28" height="29" style="display:block;width:28px;height:29px;" />
          </span>
          <span style="font-size:20px;font-weight:bold;">Journify</span>
        </div>
        <span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 auto;">
          <button type="button" data-debug-panel-close style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;background:transparent;color:#5f6368;cursor:pointer;padding:0;font-size:22px;line-height:1;" aria-label="Close debug panel">×</button>
        </span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;padding:16px 22px 10px;color:#202124;font-family:Arial,sans-serif;font-size:14px;line-height:1.4;">
      <span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:20px;height:20px;">
        ${PANEL_ICON[state]}
      </span>
      <span style="font-weight:bold;">${PANEL_MESSAGE[state]}</span>
    </div>
    <div style="display:flex;justify-content:flex-end;padding:0 16px 16px 16px;">
      <button type="button" data-debug-panel-finish style="margin-right:0;border:0;border-radius:8px;background:#d9267a;color:#ffffff;cursor:pointer;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:20px;padding:7px 20px;min-width:112px;box-shadow:none;" aria-label="Finish debugging session">Finish</button>
    </div>
  `;

  Object.assign(panel.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    width: "460px",
    maxWidth: "calc(100vw - 32px)",
    background: "#ffffff",
    border: "1px solid #dadce0",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(60,64,67,.3),0 4px 8px rgba(60,64,67,.15)",
    zIndex: "2147483647",
    overflow: "hidden",
  });

  const finishButton = panel.querySelector(
    DEBUG_PANEL_FINISH_BUTTON_SELECTOR
  );
  finishButton?.addEventListener("click", () => {
    window.close();
  });

  return panel;
}

function createPageHighlight(): HTMLDivElement {
  const existingHighlight = document.getElementById(DEBUG_PANEL_HIGHLIGHT_ID);
  existingHighlight?.remove();

  const overlay = document.createElement("div");
  overlay.id = DEBUG_PANEL_HIGHLIGHT_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.38)",
    zIndex: "2147483646",
    pointerEvents: "auto",
  });

  document.body?.appendChild(overlay);
  return overlay
}

function wirePanelHighlightCleanup(
  panel: HTMLDivElement,
  pageHighlight: HTMLDivElement,
) {
  const handleDocumentPointerDown = (event: MouseEvent) => {
    if (!panel.contains(event.target as Node)) {
      pageHighlight.remove();
      detachHighlightCleanup();
    }
  };
  const closeButton = panel.querySelector(
    DEBUG_PANEL_CLOSE_BUTTON_SELECTOR
  ) as HTMLButtonElement | null;
  const handleCloseButtonClick = (event: MouseEvent) => {
    event.preventDefault();
    pageHighlight.remove();
    panel.remove();
    detachAllCleanup();
  };

  function detachHighlightCleanup() {
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }

  function detachAllCleanup() {
    detachHighlightCleanup();
    closeButton?.removeEventListener("click", handleCloseButtonClick);
  }

  document.addEventListener("pointerdown", handleDocumentPointerDown);
  closeButton?.addEventListener("click", handleCloseButtonClick);
}

function getDebugPanelState(writeKey: string): DebugPanelState | null {
  const debugParam = new URLSearchParams(window.location.search).get(
    "journify_debug"
  );

  if (!debugParam) {
    return null;
  }

  return debugParam === writeKey ? "success" : "error";
}

export { displayDebugPanelIfNeeded };
