import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

// Mock tauri module
vi.mock("./tauri", () => ({
  connect: vi.fn(() => Promise.resolve("session-123")),
  disconnect: vi.fn(() => Promise.resolve()),
  sendData: vi.fn(() => Promise.resolve()),
  listProfiles: vi.fn(() => Promise.resolve([])),
  saveProfile: vi.fn(() => Promise.resolve()),
  deleteProfile: vi.fn(() => Promise.resolve()),
  listHistory: vi.fn(() => Promise.resolve([])),
  clearHistory: vi.fn(() => Promise.resolve()),
  listDirectory: vi.fn(() => Promise.resolve([])),
  readFile: vi.fn(() => Promise.resolve([])),
  writeFile: vi.fn(() => Promise.resolve()),
  openRemoteFile: vi.fn(() => Promise.resolve("/tmp/test")),
  unwatchRemoteFile: vi.fn(() => Promise.resolve()),
  listWatchedFiles: vi.fn(() => Promise.resolve([])),
  saveLogDialog: vi.fn(() => Promise.resolve()),
  listFileAssociations: vi.fn(() => Promise.resolve([])),
  saveFileAssociation: vi.fn(() => Promise.resolve()),
  deleteFileAssociation: vi.fn(() => Promise.resolve()),
  listCommandHistory: vi.fn(() => Promise.resolve([])),
  addCommandHistory: vi.fn(() => Promise.resolve()),
  clearCommandHistory: vi.fn(() => Promise.resolve()),
  getHotkeyConfig: vi.fn(() =>
    Promise.resolve({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    }),
  ),
  saveHotkeyConfig: vi.fn(() => Promise.resolve()),
}));

// Mock resize observer
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(
  window as unknown as { ResizeObserver: typeof ResizeObserverMock }
).ResizeObserver = ResizeObserverMock;

describe("App integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders three columns when no sessions", () => {
    render(<App />);
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getAllByText("No active connection").length).toBe(2);
  });

  it("opens connection modal when New button is clicked", async () => {
    render(<App />);
    const newBtn = screen.getByTitle("New connection");
    fireEvent.click(newBtn);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /New Connection/i }),
      ).toBeInTheDocument();
    });
  });

  it("closes modal when Cancel is clicked", async () => {
    render(<App />);
    fireEvent.click(screen.getByTitle("New connection"));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /New Connection/i }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /New Connection/i }),
      ).not.toBeInTheDocument();
    });
  });
});
