import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TerminalPanel from "./TerminalPanel";
import type { Session } from "../types";

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
    this.attachCustomKeyEventHandler = vi.fn();
    this.paste = vi.fn();
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
  });

  it("renders the session name in the tab bar", () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(screen.getByText("Test Server")).toBeInTheDocument();
  });

  it("shows the buffer size indicator", () => {
    render(<TerminalPanel {...defaultProps} />);
    // Welcome banner adds bytes to the buffer, so it's not 0 B
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
});
