/**
 * Platform-level mobile mirror injection.
 *
 * Injects a <script src="/v1/mirror.js"> tag and a <fags-mirror> Web Component
 * into every agent page. The script is served as a separate file (CSP-safe),
 * and the Web Component uses Shadow DOM for style isolation.
 *
 * MIRROR_CLIENT_JS contains the full browser-side Web Component implementation
 * that the host worker serves at /v1/mirror.js.
 */

export function injectMirror(html: string, agentSlug: string): string {
  if (!html.includes('</body>')) return html;

  const escaped = agentSlug.replace(/['"\\<>&]/g, '');
  return html.replace(
    '</body>',
    `<script src="/v1/mirror.js" defer></script>\n<fags-mirror agent="${escaped}"></fags-mirror>\n</body>`,
  );
}

/**
 * The full Web Component source, compiled to browser-compatible JS.
 * Served at /v1/mirror.js by the host worker.
 */
export const MIRROR_CLIENT_JS = `(function() {
  "use strict";

  class FagsMirrorElement extends HTMLElement {
    constructor() {
      super();
      this._roomId = "";
      this._ws = null;
      this._agent = "";
      this._panel = null;
      this._btn = null;
      this._connected = false;
      this._peers = 0;
      this._reconnectTimer = null;
    }

    connectedCallback() {
      this._agent = this.getAttribute("agent") || "unknown";
      this._render();
      this._setupEventListeners();
    }

    disconnectedCallback() {
      if (this._ws) { this._ws.close(); this._ws = null; }
      if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    }

    _render() {
      var shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = '<style>' +
        ':host { display: block; position: fixed; bottom: 20px; right: 20px; z-index: 99999; font-family: "Manrope", system-ui, sans-serif; }' +
        '.btn {' +
        '  width: 48px; height: 48px; border-radius: 50%;' +
        '  background: linear-gradient(135deg, #7c3aed, #6d28d9);' +
        '  border: none; cursor: pointer; display: flex; align-items: center;' +
        '  justify-content: center; font-size: 22px;' +
        '  box-shadow: 0 4px 12px rgba(124,58,237,0.4);' +
        '  transition: transform 0.2s, box-shadow 0.2s;' +
        '}' +
        '.btn:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(124,58,237,0.6); }' +
        '.btn.active { animation: pulse 2s infinite; }' +
        '@keyframes pulse {' +
        '  0%, 100% { box-shadow: 0 4px 12px rgba(124,58,237,0.4); }' +
        '  50% { box-shadow: 0 4px 24px rgba(124,58,237,0.8); }' +
        '}' +
        '.panel {' +
        '  position: absolute; bottom: 60px; right: 0;' +
        '  width: 320px; max-width: calc(100vw - 40px);' +
        '  background: #171717; border: 1px solid #262626; border-radius: 16px;' +
        '  box-shadow: 0 20px 60px rgba(0,0,0,0.5); padding: 20px;' +
        '  display: none; color: #fafafa; font-size: 13px;' +
        '}' +
        '.panel.open { display: block; }' +
        '.panel h3 { font-size: 14px; font-weight: 700; margin: 0 0 8px; }' +
        '.panel p { color: #a3a3a3; font-size: 12px; margin: 0 0 12px; line-height: 1.5; }' +
        '.qr-wrap { text-align: center; margin: 12px 0; background: white; border-radius: 12px; padding: 16px; }' +
        '.qr-wrap img { width: 180px; height: 180px; border-radius: 8px; }' +
        '.url-row { display: flex; gap: 6px; margin: 12px 0; }' +
        '.url-input {' +
        '  flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid #262626;' +
        '  background: #0a0a0a; color: #a78bfa; font-size: 11px; font-family: monospace;' +
        '  outline: none;' +
        '}' +
        '.copy-btn {' +
        '  padding: 8px 14px; border-radius: 8px; background: #7c3aed; color: white;' +
        '  border: none; cursor: pointer; font-size: 11px; font-weight: 600;' +
        '}' +
        '.status { font-size: 11px; color: #737373; margin: 8px 0; }' +
        '.status.connected { color: #4ade80; }' +
        '.close-btn {' +
        '  position: absolute; top: 12px; right: 12px; background: none; border: none;' +
        '  color: #737373; cursor: pointer; font-size: 18px; line-height: 1;' +
        '}' +
        '.info { font-size: 10px; color: #525252; margin-top: 8px; line-height: 1.4; }' +
        '</style>' +
        '<button class="btn" id="btn" title="Mirror to mobile">\\ud83d\\udcf1</button>' +
        '<div class="panel" id="panel">' +
        '  <button class="close-btn" id="close">&times;</button>' +
        '  <h3>\\ud83d\\udcf1 Mirror to Mobile</h3>' +
        '  <p>Scan the QR code or open the link on your phone to see this agent\\u2019s output in real-time.</p>' +
        '  <div class="qr-wrap" id="qr"><p style="color:#666;font-size:11px">Click button to activate</p></div>' +
        '  <div class="url-row">' +
        '    <input class="url-input" id="url" readonly />' +
        '    <button class="copy-btn" id="copy">Copy</button>' +
        '  </div>' +
        '  <div class="status" id="status">Click the button to start</div>' +
        '  <div class="info">' +
        '    Real-time via WebSocket. Your data stays between your devices.' +
        '    <br>Open the link on your phone, keep this tab open, results appear on both screens.' +
        '  </div>' +
        '</div>';

      this._btn = shadow.getElementById("btn");
      this._panel = shadow.getElementById("panel");
    }

    _setupEventListeners() {
      var self = this;
      var shadow = this.shadowRoot;

      shadow.getElementById("btn").addEventListener("click", function() {
        if (!self._roomId) {
          self._roomId = self._generateRoomId();
          self._activate();
        }
        self._panel.classList.toggle("open");
      });

      shadow.getElementById("close").addEventListener("click", function() {
        self._panel.classList.remove("open");
      });

      shadow.getElementById("copy").addEventListener("click", function() {
        var url = shadow.getElementById("url");
        navigator.clipboard.writeText(url.value);
        var btn = shadow.getElementById("copy");
        btn.textContent = "Copied!";
        setTimeout(function() { btn.textContent = "Copy"; }, 1500);
      });
    }

    _generateRoomId() {
      var chars = "abcdefghjkmnpqrstuvwxyz23456789";
      var bytes = crypto.getRandomValues(new Uint8Array(8));
      return Array.from(bytes).map(function(b) { return chars[b % chars.length]; }).join("");
    }

    _activate() {
      var url = location.origin + "/mirror/?room=" + this._roomId + "&agent=" + this._agent;
      var shadow = this.shadowRoot;

      // Set URL
      shadow.getElementById("url").value = url;

      // Load QR from server
      var qrEl = shadow.getElementById("qr");
      var img = document.createElement("img");
      img.src = "/v1/qr?data=" + encodeURIComponent(url);
      img.alt = "Scan with your phone camera";
      img.onload = function() { qrEl.innerHTML = ""; qrEl.appendChild(img); };
      img.onerror = function() { qrEl.innerHTML = '<p style="color:#666;font-size:12px">QR unavailable. Use the link below.</p>'; };

      // Connect WebSocket
      this._connectWS();

      // Start observing agent output
      this._observeOutput();

      // Activate button pulse
      this._btn.classList.add("active");
    }

    _connectWS() {
      var self = this;
      var wsUrl = location.origin.replace(/^http/, "ws") + "/v1/mirror/" + this._roomId + "/ws?device=desktop";
      this._ws = new WebSocket(wsUrl);

      var shadow = this.shadowRoot;
      var statusEl = shadow.getElementById("status");

      this._ws.onopen = function() {
        statusEl.textContent = "Connected. Waiting for mobile...";
      };

      this._ws.onmessage = function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type === "connected") {
            self._peers = msg.data.peers;
          } else if (msg.type === "peer_joined") {
            self._peers = msg.data.peers;
            statusEl.textContent = "Mobile connected (" + self._peers + " devices)";
            statusEl.className = "status connected";
          } else if (msg.type === "peer_left") {
            self._peers = msg.data.peers;
            if (self._peers <= 1) {
              statusEl.textContent = "Mobile disconnected. Waiting...";
              statusEl.className = "status";
            }
          }
        } catch(err) {}
      };

      this._ws.onclose = function() {
        statusEl.textContent = "Disconnected. Reconnecting...";
        statusEl.className = "status";
        self._reconnectTimer = setTimeout(function() {
          if (self._roomId) self._connectWS();
        }, 3000);
      };
    }

    /** Public API: agents call window.fagsMirror.send({ type: 'result', data: {...} }) */
    send(data) {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify(data));
      }
    }

    _observeOutput() {
      var self = this;
      var lastContent = "";
      var lastSend = 0;

      var observer = new MutationObserver(function() {
        if (!self._ws || self._ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - lastSend < 2000) return; // debounce 2s

        // Find output elements
        var selectors = [
          '[class*="assistant"]', '[class*="output"]', '[class*="result"]',
          '[class*="response"]', '[data-role="assistant"]'
        ];
        var el = document.querySelector("main") || document.body;
        var latest = "";

        for (var i = 0; i < selectors.length; i++) {
          var nodes = el.querySelectorAll(selectors[i]);
          if (nodes.length > 0) {
            var text = nodes[nodes.length - 1].textContent;
            latest = text ? text.trim().slice(0, 2000) : "";
            break;
          }
        }

        if (latest && latest !== lastContent) {
          lastContent = latest;
          lastSend = Date.now();
          self.send({ type: "result", data: { text: latest, agent: self._agent } });
        }
      });

      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  // Register the Web Component
  if (!customElements.get("fags-mirror")) {
    customElements.define("fags-mirror", FagsMirrorElement);
  }

  // Expose for programmatic use: window.fagsMirror = document.querySelector('fags-mirror')
  Object.defineProperty(window, "FagsMirror", { value: FagsMirrorElement, writable: false });

  // Convenience: expose the first instance as window.fagsMirror once it connects
  var _origDefine = customElements.define;
  requestAnimationFrame(function check() {
    var el = document.querySelector("fags-mirror");
    if (el) { window.fagsMirror = el; }
    else { requestAnimationFrame(check); }
  });
})();
`;
