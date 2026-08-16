// Dependency-free, style-isolated, under 3KB unminified.
(function () {
  "use strict";
  // Derived from the <script> tag's own src so the popup always targets
  // wherever this widget was loaded from (production, staging, or a local
  // dev server) instead of a hardcoded host.
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

  function getPartnerMeta() {
    var script = document.currentScript || document.querySelector("script[data-api-key]");
    return {
      apiKey: script ? script.getAttribute("data-api-key") : null,
      buttonLabel: script ? (script.getAttribute("data-label") || "Save to WhatsApp") : "Save to WhatsApp",
      buttonColor: script ? (script.getAttribute("data-color") || "#25D366") : "#25D366"
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
    return BASE + "/save?" + p.toString();
  }

  function openSavePopup(url) {
    var w = 420, h = 640;
    var left = Math.max(0, (window.screen.width - w) / 2), top = Math.max(0, (window.screen.height - h) / 2);
    window.open(url, "sor7ed_save", "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top + ",resizable=yes");
  }

  function injectButton(target) {
    var partnerMeta = getPartnerMeta();
    if (!partnerMeta.apiKey) return;
    var pageMeta = getPageMeta(target);
    var btn = document.createElement("button");
    btn.textContent = partnerMeta.buttonLabel;
    btn.setAttribute("aria-label", partnerMeta.buttonLabel);
    btn.style.cssText = ["display:inline-flex", "align-items:center", "gap:6px", "padding:10px 16px", "border:none", "border-radius:8px", "background:" + partnerMeta.buttonColor, "color:#fff", "font-family:inherit", "font-size:14px", "font-weight:600", "cursor:pointer", "white-space:nowrap"].join(";");
    btn.addEventListener("click", function () { openSavePopup(buildSaveUrl(partnerMeta, pageMeta)); });
    (target || document.body).appendChild(btn);
  }

  function init() {
    var targets = document.querySelectorAll("[data-sor7ed]");
    if (targets.length > 0) { targets.forEach(injectButton); } else { injectButton(null); }
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
