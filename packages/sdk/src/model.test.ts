import { describe, expect, it, vi } from 'vitest';
import { ModelLoader } from './model.js';

describe('ModelLoader', () => {
  it('hasWebGPU() returns false when navigator.gpu is absent', async () => {
    vi.stubGlobal('navigator', {});
    expect(await ModelLoader.hasWebGPU()).toBe(false);
  });

  it('hasWebGPU() returns true when adapter is available', async () => {
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: vi.fn().mockResolvedValue({}) },
    });
    expect(await ModelLoader.hasWebGPU()).toBe(true);
  });

  it('hasWebGPU() returns false when adapter is null', async () => {
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: vi.fn().mockResolvedValue(null) },
    });
    expect(await ModelLoader.hasWebGPU()).toBe(false);
  });

  it('resolveDevice() returns wasm when explicitly requested', async () => {
    expect(await ModelLoader.resolveDevice('wasm')).toBe('wasm');
  });

  it('resolveDevice() returns wasm when no GPU', async () => {
    vi.stubGlobal('navigator', {});
    expect(await ModelLoader.resolveDevice('auto')).toBe('wasm');
  });

  it('resolveDevice() returns webgpu when GPU available', async () => {
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: vi.fn().mockResolvedValue({}) },
    });
    expect(await ModelLoader.resolveDevice('auto')).toBe('webgpu');
  });

  it('starts with idle status', () => {
    const loader = new ModelLoader();
    expect(loader.getStatus()).toEqual({ state: 'idle' });
  });

  it('onStatusChange fires immediately with current status', () => {
    const loader = new ModelLoader();
    const fn = vi.fn();
    loader.onStatusChange(fn);
    expect(fn).toHaveBeenCalledWith({ state: 'idle' });
  });

  it('updateFromWorker transitions to ready', () => {
    const loader = new ModelLoader();
    const fn = vi.fn();
    loader.onStatusChange(fn);
    loader.updateFromWorker({ type: 'model-ready' });
    expect(fn).toHaveBeenCalledWith({ state: 'ready' });
  });

  it('updateFromWorker transitions to error', () => {
    const loader = new ModelLoader();
    const fn = vi.fn();
    loader.onStatusChange(fn);
    loader.updateFromWorker({ type: 'error', error: 'OOM' });
    expect(fn).toHaveBeenCalledWith({ state: 'error', error: 'OOM' });
  });

  it('updateFromWorker tracks download progress', () => {
    const loader = new ModelLoader();
    const fn = vi.fn();
    loader.onStatusChange(fn);
    loader.updateFromWorker({ type: 'download-progress', progress: 50, totalBytes: 200_000_000 });
    expect(fn).toHaveBeenCalledWith({
      state: 'downloading',
      progress: 50,
      totalBytes: 200_000_000,
    });
  });
});
