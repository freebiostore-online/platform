/**
 * Kokoro TTS Web Worker
 * Loads the model, generates audio from text, sends back Float32 PCM.
 */

let tts = null;

async function loadTts() {
  const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
  const candidates = [];

  if (typeof navigator !== 'undefined' && navigator.gpu) {
    candidates.push({ device: 'webgpu', dtype: 'fp32' });
  }
  candidates.push({ device: 'wasm', dtype: 'q8' });

  let lastError = null;
  for (const c of candidates) {
    try {
      self.postMessage({ type: 'progress', pct: c.device === 'webgpu' ? 25 : 60 });
      const loaded = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: c.dtype,
        device: c.device,
      });
      return { tts: loaded, device: c.device, dtype: c.dtype };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to init Kokoro');
}

self.onmessage = async (e) => {
  const { type } = e.data;

  if (type === 'init') {
    try {
      self.postMessage({ type: 'progress', pct: 0 });
      const result = await loadTts();
      tts = result.tts;
      self.postMessage({ type: 'progress', pct: 100 });
      self.postMessage({ type: 'ready', device: result.device, dtype: result.dtype });
    } catch (err) {
      self.postMessage({ type: 'error', error: err?.message || String(err) });
    }
    return;
  }

  if (type === 'generate') {
    const { id, text, voice } = e.data;
    if (!tts) {
      self.postMessage({ type: 'error', id, error: 'Model not loaded' });
      return;
    }
    try {
      const result = await tts.generate(text, { voice });
      self.postMessage(
        { type: 'audio', id, audio: result.audio, sampleRate: result.sampling_rate },
        [result.audio.buffer],
      );
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err?.message || String(err) });
    }
  }
};
