import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "./Sidebar";
import type { Session, ConnectionProfile } from "../types";

const mockProfile: ConnectionProfile = {
  id: "profile-1",
  name: "Test Server",
  host: "192.168.1.1",
  port: 22,
  username: "root",
  authType: "password",
  color: "#6366f1",
};

const mockSession: Session = {
  id: "session-1",
  profile: mockProfile,
  status: "connected",
};

const defaultProps = {
  sessions: [] as Session[],
  activeSessionId: null as string | null,
  onActivateSession: vi.fn(),
  onCloseSession: vi.fn(),
  onNewConnection: vi.fn(),
  collapsed: false,
  onExpand: vi.fn(),
};

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the connections header", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Connections")).toBeInTheDocument();
  });

  it("shows empty state when no sessions", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("No active sessions")).toBeInTheDocument();
  });

  it("calls onNewConnection when New button is clicked", () => {
    render(<Sidebar {...defaultProps} />);
    const newButtons = screen.getAllByTitle("New connection");
    fireEvent.click(newButtons[0]);
    expect(defaultProps.onNewConnection).toHaveBeenCalled();
  });

  it("renders session chips with URL and User info", () => {
    render(<Sidebar {...defaultProps} sessions={[mockSession]} />);
    expect(screen.getByText("Test Server")).toBeInTheDocument();
    expect(screen.getByText(/URL: 192.168.1.1:22/)).toBeInTheDocument();
    expect(screen.getByText(/User: root/)).toBeInTheDocument();
  });

  it("calls onActivateSession when session chip is clicked", () => {
    render(<Sidebar {...defaultProps} sessions={[mockSession]} />);
    fireEvent.click(screen.getByText("Test Server"));
    expect(defaultProps.onActivateSession).toHaveBeenCalledWith("session-1");
  });

  it("calls onCloseSession when close button is clicked", () => {
    render(<Sidebar {...defaultProps} sessions={[mockSession]} />);
    const closeBtn = screen.getByTitle("Close session");
    fireEvent.click(closeBtn);
    expect(defaultProps.onCloseSession).toHaveBeenCalledWith("session-1");
  });

  it("calls onExpand when collapse button is clicked", () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Collapse connections"));
    expect(defaultProps.onExpand).toHaveBeenCalled();
  });

  it("renders collapsed sidebar with icon toolbar", () => {
    render(<Sidebar {...defaultProps} collapsed={true} />);
    expect(screen.queryByText("Connections")).not.toBeInTheDocument();
    expect(screen.getByTitle("Expand connections")).toBeInTheDocument();
  });
});
