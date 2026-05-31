import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import FileBrowser from "./FileBrowser";
import type { Session, RemoteFile } from "../types";

vi.mock("../tauri", () => ({
  listDirectory: vi.fn(),
  listFileAssociations: vi.fn(() => Promise.resolve([])),
  openRemoteFile: vi.fn(() => Promise.resolve("/tmp/test")),
  listWatchedFiles: vi.fn(() => Promise.resolve([])),
}));

import { listDirectory } from "../tauri";

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

const mockFiles: RemoteFile[] = [
  {
    name: "home",
    path: "/home",
    is_directory: true,
    size: 4096,
    modified: 1700000000,
    permissions: 0o755,
  },
  {
    name: "README.txt",
    path: "/README.txt",
    is_directory: false,
    size: 128,
    modified: 1700000100,
    permissions: 0o644,
  },
];

const defaultProps = {
  session: mockSession,
  collapsed: false,
  onToggleCollapse: vi.fn(),
};

describe("FileBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders breadcrumb with home link", () => {
    render(<FileBrowser {...defaultProps} />);
    expect(screen.getByText("~")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<FileBrowser {...defaultProps} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Modified")).toBeInTheDocument();
    expect(screen.getByText("Perm")).toBeInTheDocument();
  });

  it("calls listDirectory when session is connected", async () => {
    vi.mocked(listDirectory).mockResolvedValue(mockFiles);

    render(<FileBrowser {...defaultProps} />);

    await waitFor(() => {
      expect(listDirectory).toHaveBeenCalledWith("session-1", "/home/root");
    });
  });

  it("displays files after loading", async () => {
    vi.mocked(listDirectory).mockResolvedValue(mockFiles);

    render(<FileBrowser {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("README.txt")).toBeInTheDocument();
    });
    expect(screen.getByTitle("home")).toBeInTheDocument();
  });

  it("does not call listDirectory when session is not connected", () => {
    const connectingSession = { ...mockSession, status: "connecting" as const };
    render(<FileBrowser {...defaultProps} session={connectingSession} />);
    expect(listDirectory).not.toHaveBeenCalled();
  });
});
