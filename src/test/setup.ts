import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Global store for event callbacks so tests can simulate backend events
const eventCallbacks: Record<string, ((event: any) => void)[]> = {};

export function emitTauriEvent(eventName: string, payload: any) {
  (eventCallbacks[eventName] || []).forEach((cb) => cb({ payload }));
}

export function clearTauriEvents() {
  Object.keys(eventCallbacks).forEach((k) => delete eventCallbacks[k]);
}

// Mock Tauri invoke globally
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock Tauri event API — stores callbacks so tests can emit events
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((eventName: string, callback: (event: any) => void) => {
    if (!eventCallbacks[eventName]) {
      eventCallbacks[eventName] = [];
    }
    eventCallbacks[eventName].push(callback);
    return Promise.resolve(() => {
      const idx = eventCallbacks[eventName].indexOf(callback);
      if (idx > -1) eventCallbacks[eventName].splice(idx, 1);
    });
  }),
}));

// Mock Tauri dialog plugin
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(() => Promise.resolve(null)),
}));

// Mock xterm — use vi.fn(impl) so the constructor itself is a trackable spy
vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn(function (this: any) {
    this.open = vi.fn();
    this.write = vi.fn();
    this.writeln = vi.fn();
    this.clear = vi.fn();
    this.dispose = vi.fn();
    this.loadAddon = vi.fn();
    this.onData = vi.fn();
    this.onResize = vi.fn();
    this.refresh = vi.fn();
    this.cols = 80;
    this.rows = 24;
    this.options = {};
  }),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn(function (this: any) {
    this.fit = vi.fn();
    this.proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
  }),
}));

// Clean up after each test
afterEach(() => {
  cleanup();
  clearTauriEvents();
});
