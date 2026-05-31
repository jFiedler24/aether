import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConnectionModal from "./ConnectionModal";
import type { ConnectionProfile } from "../types";

const mockProfile: ConnectionProfile = {
  id: "profile-1",
  name: "Test Server",
  host: "192.168.1.1",
  port: 22,
  username: "root",
  authType: "password",
  password: "secret",
  color: "#6366f1",
};

describe("ConnectionModal", () => {
  const onConnect = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders new connection form", () => {
    render(<ConnectionModal onConnect={onConnect} onClose={onClose} />);
    expect(
      screen.getByRole("heading", { name: /New Connection/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("My Server")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("192.168.1.1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("root")).toBeInTheDocument();
  });

  it("renders edit mode with pre-filled data", () => {
    render(
      <ConnectionModal
        onConnect={onConnect}
        onClose={onClose}
        initialProfile={mockProfile}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /Edit Connection/i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Server")).toBeInTheDocument();
    expect(screen.getByDisplayValue("192.168.1.1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("root")).toBeInTheDocument();
  });

  it("calls onConnect when form is submitted", async () => {
    render(<ConnectionModal onConnect={onConnect} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("My Server"), {
      target: { value: "New Server" },
    });
    fireEvent.change(screen.getByPlaceholderText("192.168.1.1"), {
      target: { value: "10.0.0.1" },
    });
    fireEvent.change(screen.getByPlaceholderText("root"), {
      target: { value: "admin" },
    });

    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(onConnect).toHaveBeenCalled();
    });

    const profile = onConnect.mock.calls[0][0] as ConnectionProfile;
    expect(profile.name).toBe("New Server");
    expect(profile.host).toBe("10.0.0.1");
    expect(profile.username).toBe("admin");
    expect(profile.port).toBe(22);
  });

  it("calls onClose when Cancel is clicked", () => {
    render(<ConnectionModal onConnect={onConnect} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("switches auth type tabs", () => {
    render(<ConnectionModal onConnect={onConnect} onClose={onClose} />);

    // Default is password
    expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();

    // Switch to key
    fireEvent.click(screen.getByText("SSH Key"));
    expect(
      screen.getByPlaceholderText(/~\/\.ssh\/id_rsa/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Enter password"),
    ).not.toBeInTheDocument();

    // Switch to agent
    fireEvent.click(screen.getByText("Agent"));
    expect(
      screen.queryByPlaceholderText("Enter password"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/~\/\.ssh\/id_rsa/i),
    ).not.toBeInTheDocument();
  });
});
