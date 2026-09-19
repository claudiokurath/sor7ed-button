// SOR7ED save button — embeddable widget.
// Style-isolated (all rules scoped under .s7-widget), single external
// font request (JetBrains Mono, non-blocking), otherwise dependency-free.
//
// Visual design: hand-drawn "tangle" mark that resolves into a tick on
// save, ported from sorted-button/sorted-button.html (v9). The animation
// only plays on a REAL confirmed save (via postMessage from the /save
// popup) — it does not fire optimistically on click, so the on-page state
// always reflects whether the save actually completed.
(function () {
  "use strict";

  // Derived from the <script> tag's own src so the popup + assets always
  // target wherever this widget was loaded from (production, staging, or
  // a local dev server) instead of a hardcoded host.
  var BASE = (function () {
    var script = document.currentScript || document.querySelector("script[data-api-key]");
    if (script && script.src) {
      try {
        return new URL(script.src).origin;
      } catch (e) {
        // fall through
      }
    }
    return "https://sor7ed.com";
  })();

  var TANGLE_URL = BASE + "/static/tangle.png";
  var IN = 620, OUT = 420, HOLD = 2400, TICK_AT = 0.28;

  function ease(p) { return 1 - Math.pow(1 - p, 3.2); } // ≈ cubic-bezier(.16,1,.3,1)

  // ── styles (injected once, scoped under .s7-widget) ──────────────────
  var stylesInjected = false;
  function injectStylesOnce() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement("style");
    style.textContent = [
      ".s7-widget{",
      "--s7-ink:#221e18;--s7-accent:#25D366;--s7-muted:#897f6e;--s7-line:#e1d8c6;",
      "--s7-ease:cubic-bezier(0.16,1,0.3,1);--s7-mark:56px;--s7-t:0;--s7-td:0;",
      "display:inline-flex;align-items:center;justify-content:center;gap:14px;",
      "font-family:'JetBrains Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;",
      "}",
      ".s7-widget__label{font-size:11px;letter-spacing:0.1em;text-transform:uppercase;",
      "white-space:nowrap;color:color-mix(in oklab,var(--s7-muted),var(--s7-accent) calc(var(--s7-td)*100%));",
      "transition:color 0.32s var(--s7-ease);}",
      ".s7-widget__label--lead{text-align:right;}",
      ".s7-widget__btn{appearance:none;width:calc(var(--s7-mark) + 16px);height:calc(var(--s7-mark) + 16px);",
      "padding:0;border:none;background:transparent;border-radius:50%;display:inline-flex;",
      "align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;",
      "transition:transform 0.2s var(--s7-ease);}",
      ".s7-widget__btn:active{transform:scale(0.96);}",
      ".s7-widget__btn:focus-visible{outline:1px solid var(--s7-accent);outline-offset:3px;}",
      ".s7-widget__mark{position:relative;display:block;width:var(--s7-mark);height:var(--s7-mark);",
      "transition:transform 0.6s var(--s7-ease);}",
      ".s7-widget__mark:hover{transform:rotate(-3deg) scale(1.03);}",
      ".s7-widget__tangle{position:absolute;inset:0;width:100%;height:100%;transform-origin:52% 54%;",
      "opacity:calc(1 - var(--s7-t));transform:scale(calc(1 - 0.12*var(--s7-t))) rotate(calc(var(--s7-t)*-8deg));}",
      ".s7-widget__tick{position:absolute;inset:0;width:100%;height:100%;overflow:visible;opacity:var(--s7-td);}",
      ".s7-widget__tick path{fill:none;stroke:var(--s7-accent);stroke-width:2.6;stroke-linecap:round;",
      "stroke-linejoin:round;stroke-dasharray:46;stroke-dashoffset:calc(46px*(1 - var(--s7-td)));}",
      ".s7-widget__sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;",
      "clip:rect(0,0,0,0);white-space:nowrap;border:0;}"
    ].join("");
    document.head.appendChild(style);
  }

  // Non-blocking — appended after the widget's own DOM work, so a slow or
  // failed font fetch never delays the button showing up. Falls back to
  // the monospace stack in the meantime (and permanently, if it fails).
  var fontInjected = false;
  function injectFontOnce() {
    if (fontInjected) return;
    fontInjected = true;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }

  function getPartnerMeta() {
    // querySelector's fallback also matches data-demo, not just
    // data-api-key, so a demo embed (which deliberately carries no real
    // apiKey) is still found the same way a normal partner embed is.
    var script = document.currentScript || document.querySelector("script[data-api-key],script[data-demo]");
    return {
      apiKey: script ? script.getAttribute("data-api-key") : null,
      // Lets a prospect try the entire save->WhatsApp loop with zero
      // signup, zero real WhatsApp number, and no partner account —
      // routes to /save/demo instead of /save (see buildSaveUrl below),
      // which simulates the flow client-side with no backend calls at
      // all. Marketing/sales entry point, not a real partner feature.
      isDemo: script ? script.getAttribute("data-demo") === "true" : false,
      leadLabel: script ? (script.getAttribute("data-label") || "Save this piece") : "Save this piece",
      accentColor: script ? (script.getAttribute("data-color") || "#25D366") : "#25D366"
    };
  }

  function getPageMeta(target) {
    var get = function (attr) { return target ? target.getAttribute("data-" + attr) : null; };
    return {
      title: get("title") || document.querySelector("meta[property='og:title']")?.getAttribute("content") || document.title,
      url: get("url") || document.querySelector("meta[property='og:url']")?.getAttribute("content") || window.location.href,
      description: get("description") || document.querySelector("meta[property='og:description']")?.getAttribute("content") || "",
      image: get("image") || document.querySelector("meta[property='og:image']")?.getAttribute("content") || ""
    };
  }

  function buildSaveUrl(partnerMeta, pageMeta) {
    var p = new URLSearchParams({ apiKey: partnerMeta.apiKey || "", url: pageMeta.url, title: pageMeta.title, description: pageMeta.description, image: pageMeta.image });
    return BASE + (partnerMeta.isDemo ? "/save/demo?" : "/save?") + p.toString();
  }

  // Only one save flow is ever in flight per widget instance at a time —
  // tracked per-button so multiple buttons on one page don't cross-wire
  // their popups or animations.
  function attachSaveFlow(root, btn, saveUrl) {
    var state = { popup: null, pollTimer: null, messageHandler: null };

    function cleanup() {
      if (state.pollTimer) clearInterval(state.pollTimer);
      if (state.messageHandler) window.removeEventListener("message", state.messageHandler);
      state.popup = null;
      state.pollTimer = null;
      state.messageHandler = null;
      btn.removeAttribute("aria-busy");
    }

    btn.addEventListener("click", function () {
      // Clicking again while a save is already in flight just refocuses
      // the existing popup instead of opening a duplicate window.
      if (state.popup && !state.popup.closed) {
        state.popup.focus();
        return;
      }

      var w = 420, h = 640;
      var left = Math.max(0, (window.screen.width - w) / 2), top = Math.max(0, (window.screen.height - h) / 2);
      var popup = window.open(saveUrl, "sor7ed_save", "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top + ",resizable=yes");

      // Popup blocked (rare on a direct click handler, but possible under
      // aggressive blocker settings) — fall back to a plain new-tab
      // navigation so the save flow still completes, just without the
      // on-page confirmation animation (there's no window handle to
      // listen on).
      if (!popup) {
        var a = document.createElement("a");
        a.href = saveUrl;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      state.popup = popup;
      btn.setAttribute("aria-busy", "true");

      state.messageHandler = function (event) {
        if (!event.data || event.data.source !== "sor7ed-widget" || event.data.type !== "saved") return;
        runDoneAnimation(root);
        cleanup();
      };
      window.addEventListener("message", state.messageHandler);

      // The popup is a different origin from the host page, so the only
      // way to know the user closed it without saving (no message ever
      // arrives) is polling .closed — there's no cross-origin unload
      // event available here.
      state.pollTimer = setInterval(function () {
        if (state.popup && state.popup.closed) cleanup();
      }, 500);
    });
  }

  function runDoneAnimation(root) {
    var lead = root.querySelector("[data-s7-lead]");
    var trail = root.querySelector("[data-s7-trail]");
    var live = root.querySelector("[data-s7-live]");
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var restLead = lead.getAttribute("data-s7-rest-text");
    var restTrail = "tap the mark";

    function paint(v) {
      var td = Math.max(0, Math.min(1, (v - TICK_AT) / (1 - TICK_AT)));
      root.style.setProperty("--s7-t", v.toFixed(3));
      root.style.setProperty("--s7-td", td.toFixed(3));
    }

    function run(to, from, dur, onDone) {
      if (reduce) { paint(to); if (onDone) onDone(); return; }
      var start = performance.now();
      (function step(now) {
        var p = Math.min(1, (now - start) / dur);
        paint(from + (to - from) * ease(p));
        if (p < 1) requestAnimationFrame(step);
        else if (onDone) onDone();
      })(performance.now());
    }

    lead.textContent = "Saved to your chat";
    trail.textContent = "sorted.";
    if (live) live.textContent = "Saved to your WhatsApp chat";

    run(1, 0, IN, function () {
      setTimeout(function () {
        run(0, 1, OUT, function () {
          lead.textContent = restLead;
          trail.textContent = restTrail;
        });
      }, HOLD);
    });
  }

  function createWidget(partnerMeta, pageMeta) {
    injectStylesOnce();
    injectFontOnce();

    var root = document.createElement("div");
    root.className = "s7-widget";
    root.style.setProperty("--s7-accent", partnerMeta.accentColor);

    var lead = document.createElement("span");
    lead.className = "s7-widget__label s7-widget__label--lead";
    lead.setAttribute("data-s7-lead", "");
    lead.setAttribute("data-s7-rest-text", partnerMeta.leadLabel);
    lead.textContent = partnerMeta.leadLabel;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "s7-widget__btn";
    btn.setAttribute("aria-label", partnerMeta.leadLabel + " — SOR7ED");

    var mark = document.createElement("span");
    mark.className = "s7-widget__mark";

    var img = document.createElement("img");
    img.className = "s7-widget__tangle";
    img.src = TANGLE_URL;
    img.alt = "";
    img.draggable = false;

    var svgNs = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "s7-widget__tick");
    svg.setAttribute("viewBox", "-24 -24 48 48");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", "M -13 1 L -3 11 L 15 -11");
    svg.appendChild(path);

    mark.appendChild(img);
    mark.appendChild(svg);
    btn.appendChild(mark);

    var trail = document.createElement("span");
    trail.className = "s7-widget__label";
    trail.setAttribute("data-s7-trail", "");
    trail.textContent = "tap the mark";

    // Polite live region — the visual change on save is quiet (a small
    // icon swap), so screen reader users get an explicit announcement too.
    var live = document.createElement("span");
    live.className = "s7-widget__sr";
    live.setAttribute("data-s7-live", "");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");

    root.appendChild(lead);
    root.appendChild(btn);
    root.appendChild(trail);
    root.appendChild(live);

    attachSaveFlow(root, btn, buildSaveUrl(partnerMeta, pageMeta));

    return root;
  }

  function injectButton(target) {
    var partnerMeta = getPartnerMeta();
    if (!partnerMeta.apiKey && !partnerMeta.isDemo) return;
    var pageMeta = getPageMeta(target);
    var widget = createWidget(partnerMeta, pageMeta);
    (target || document.body).appendChild(widget);
  }

  function init() {
    var targets = document.querySelectorAll("[data-sor7ed]");
    if (targets.length > 0) { targets.forEach(injectButton); } else { injectButton(null); }
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
