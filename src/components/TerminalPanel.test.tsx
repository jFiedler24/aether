import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import TerminalPanel from "./TerminalPanel";
import type { Session } from "../types";
import { emitTauriEvent } from "../test/setup";

import { Terminal } from "@xterm/xterm";

const mockSession: Session = {
  id: "session-1",
  profile: {
    id: "profile-1",
    name: "Test Server",
    host: "192.168.1.1",
    port: 22,
    username: "root",
    authType: "password",
    color: "#6366f1",
  },
  status: "connected",
};

const defaultProps = {
  session: mockSession,
  collapsed: false,
  onToggleCollapse: vi.fn(),
  onOpenSettings: vi.fn(),
  onReconnect: vi.fn(),
  onCloseSession: vi.fn(),
};

describe("TerminalPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Give the terminal container non-zero dimensions so xterm.js is created
    // immediately instead of deferred.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 600,
    });
  });

  afterEach(() => {
    // Clean up the prototype overrides so they don't leak to other test files
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 0,
    });
  });

  it("renders the session name in the tab bar", () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(screen.getByText("Test Server")).toBeInTheDocument();
  });

  it("shows the buffer size indicator", () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(screen.getByText(/\/ 5 MB/)).toBeInTheDocument();
  });

  it("shows Save Log and Clear buttons", () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(screen.getByTitle("Save terminal log")).toBeInTheDocument();
    expect(screen.getByTitle("Clear terminal & buffer")).toBeInTheDocument();
  });

  it("shows error banner when session has error", () => {
    const errorSession: Session = {
      ...mockSession,
      status: "error",
      error: "Connection refused",
    };
    render(<TerminalPanel {...defaultProps} session={errorSession} />);
    expect(screen.getByText("Connection failed:")).toBeInTheDocument();
    expect(
      screen.getAllByText("Connection refused").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows disconnected overlay with reconnect button when session is in error state", () => {
    const errorSession: Session = {
      ...mockSession,
      status: "error",
      error: "Connection closed by remote host",
    };
    render(<TerminalPanel {...defaultProps} session={errorSession} />);
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
    expect(screen.getByText("Reconnect")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("creates a terminal instance on mount", () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(Terminal).toHaveBeenCalled();
  });

  it("writes incoming SSH data to the terminal", async () => {
    render(<TerminalPanel {...defaultProps} />);

    // Simulate backend sending prompt bytes
    const promptBytes = new TextEncoder().encode("pi@raspberrypi:~$ ");
    emitTauriEvent("ssh-data-session-1", Array.from(promptBytes));

    await waitFor(() => {
      const terminalInstance = (Terminal as any).mock.results[0].value;
      expect(terminalInstance.write).toHaveBeenCalledWith("pi@raspberrypi:~$ ");
    });
  });

  it("shows a no-data hint when connected but nothing received after 2s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<TerminalPanel {...defaultProps} />);

    // Fast-forward 2.5 seconds inside act so React processes the state update
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(
      screen.getByText(/Waiting for remote host data/i),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });
});
