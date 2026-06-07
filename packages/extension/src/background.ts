/**
 * Background Service Worker
 *
 * Manages extension state, coordinates recording/replay,
 * and handles training requests.
 */

import { getAutomations, loadState, saveAutomation, saveState } from './store';
import { train } from './trainer';
import type { Automation, RecordedAction, TestCase } from './types';

// In-progress recording state
let recordingTabId: number | null = null;
let pendingActions: RecordedAction[] = [];
let pendingName = '';

// Open side panel on extension icon click
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });

// Listen for messages from content scripts and popup/sidepanel
chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
  handleMessage(msg, sender, sendResponse);
  return true; // async
});

async function handleMessage(
  msg: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: any) => void,
) {
  switch (msg.type) {
    case 'BG_START_RECORDING': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ ok: false });
        return;
      }
      recordingTabId = tab.id;
      pendingActions = [];
      pendingName = msg.name ?? 'Untitled';
      await saveState({ recording: true });
      await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
      sendResponse({ ok: true });
      break;
    }

    case 'BG_STOP_RECORDING': {
      if (!recordingTabId) {
        sendResponse({ ok: false });
        return;
      }
      await chrome.tabs.sendMessage(recordingTabId, { type: 'STOP_RECORDING' });
      await saveState({ recording: false });

      // Create the automation
      const automation: Automation = {
        id: crypto.randomUUID(),
        name: pendingName,
        urlPattern: pendingActions[0]?.url ? `${new URL(pendingActions[0].url).origin}/*` : '*',
        site: pendingActions[0]?.url ? new URL(pendingActions[0].url).hostname : 'unknown',
        actions: pendingActions,
        testCases: [],
        history: [],
        accuracy: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveAutomation(automation);
      await saveState({ currentAutomationId: automation.id });
      recordingTabId = null;
      sendResponse({ ok: true, automation });
      break;
    }

    case 'ACTION_RECORDED': {
      pendingActions.push(msg.action);
      break;
    }

    case 'BG_REPLAY': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ ok: false });
        return;
      }
      await chrome.tabs.sendMessage(tab.id, { type: 'REPLAY', automation: msg.automation });
      sendResponse({ ok: true });
      break;
    }

    case 'REPLAY_DONE': {
      // If there were failures, add them as test cases
      if (msg.newTestCases?.length > 0 && msg.automationId) {
        const automations = await getAutomations();
        const auto = automations.find((a) => a.id === msg.automationId);
        if (auto) {
          auto.testCases.push(...(msg.newTestCases as TestCase[]));
          auto.updatedAt = Date.now();
          await saveAutomation(auto);
        }
      }
      break;
    }

    case 'BG_TRAIN': {
      const automations = await getAutomations();
      const auto = automations.find((a) => a.id === msg.automationId);
      if (!auto) {
        sendResponse({ ok: false, error: 'Automation not found' });
        return;
      }

      try {
        const result = await train(auto);
        // Only update if improved
        const prevAccuracy = auto.accuracy;
        if (result.score >= prevAccuracy / 100) {
          auto.heuristicCode = result.code;
          auto.accuracy = Math.round(result.score * 100);
          auto.history.push({
            version: auto.history.length + 1,
            score: result.score,
            testCount: result.total,
            source: result.source,
            timestamp: Date.now(),
          });
          auto.updatedAt = Date.now();
          await saveAutomation(auto);
        }
        sendResponse({ ok: true, result, improved: result.score >= prevAccuracy / 100 });
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      break;
    }

    case 'BG_GET_AUTOMATIONS': {
      const automations = await getAutomations();
      sendResponse({ automations });
      break;
    }

    case 'BG_GET_STATE': {
      const state = await loadState();
      const automations = await getAutomations();
      sendResponse({
        recording: state.recording,
        automations,
        currentAutomationId: state.currentAutomationId,
      });
      break;
    }

    case 'BG_DELETE_AUTOMATION': {
      const { deleteAutomation } = await import('./store');
      await deleteAutomation(msg.automationId);
      sendResponse({ ok: true });
      break;
    }

    default:
      sendResponse({ ok: false, error: 'Unknown message type' });
  }
}
