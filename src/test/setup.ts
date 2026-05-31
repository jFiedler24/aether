import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock Tauri invoke globally
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock Tauri event API
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
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
});
