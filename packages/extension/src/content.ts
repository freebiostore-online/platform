/**
 * Content Script — injected into every page.
 *
 * Responsibilities:
 * 1. Listen for recording start/stop from background
 * 2. Record user actions via the Recorder
 * 3. Replay automations via the Player
 * 4. Capture HTML snapshots for training
 */

import { failureToTestCase, replay } from './player';
import { isRecording, startRecording, stopRecording } from './recorder';
import type { ExtMessage, RecordedAction } from './types';

// Recording indicator overlay
let indicator: HTMLElement | null = null;

function showIndicator() {
  if (indicator) return;
  indicator = document.createElement('div');
  indicator.setAttribute('data-fags-ignore', '');
  Object.assign(indicator.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    zIndex: '2147483647',
    padding: '6px 12px',
    borderRadius: '20px',
    background: '#dc2626',
    color: 'white',
    fontSize: '12px',
    fontFamily: 'system-ui',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  });
  indicator.innerHTML =
    '<span style="width:8px;height:8px;border-radius:50%;background:white;animation:fags-pulse 1s infinite"></span> Recording';
  const style = document.createElement('style');
  style.textContent = '@keyframes fags-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }';
  indicator.appendChild(style);
  document.body.appendChild(indicator);
}

function hideIndicator() {
  indicator?.remove();
  indicator = null;
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  switch (msg.type) {
    case 'START_RECORDING':
      showIndicator();
      startRecording((action: RecordedAction) => {
        chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', action });
      });
      sendResponse({ ok: true });
      break;

    case 'STOP_RECORDING': {
      hideIndicator();
      const actions = stopRecording();
      sendResponse({ ok: true, actions });
      break;
    }

    case 'RECORDING_STATUS':
      sendResponse({ recording: isRecording() });
      break;

    case 'REPLAY':
      (async () => {
        const result = await replay(msg.automation.actions, msg.automation.heuristicCode, {
          onStep: (index, _action, status, selector) => {
            chrome.runtime.sendMessage({ type: 'REPLAY_STEP', index, status, selector });
          },
          onDone: (result) => {
            // Convert failures to test cases and send back
            const newTestCases = result.failures.map(failureToTestCase);
            chrome.runtime.sendMessage({
              type: 'REPLAY_DONE',
              success: result.success,
              failedStep: result.failures[0]?.stepIndex,
              newTestCases,
            });
          },
        });
        sendResponse({ ok: true, result });
      })();
      return true; // async response

    case 'CAPTURE_HTML': {
      // Capture page HTML for training
      const main =
        document.querySelector('main, [role="main"], #main, #content, #app, #root') ??
        document.body;
      const clone = main.cloneNode(true) as Element;
      clone
        .querySelectorAll('script, style, link, noscript, svg, [data-fags-ignore]')
        .forEach((n) => n.remove());
      let html = clone.innerHTML;
      if (html.length > 10240) html = `${html.slice(0, 10240)}<!-- truncated -->`;
      sendResponse({ html, url: location.href });
      break;
    }

    case 'GET_STATE':
      sendResponse({ recording: isRecording() });
      break;
  }
});
