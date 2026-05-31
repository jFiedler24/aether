import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsModal from "./SettingsModal";

vi.mock("../tauri", () => ({
  listFileAssociations: vi.fn(),
  saveFileAssociation: vi.fn(),
  deleteFileAssociation: vi.fn(),
  getHotkeyConfig: vi.fn(),
  saveHotkeyConfig: vi.fn(),
  clearCommandHistory: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(() => Promise.resolve(null)),
}));

import {
  listFileAssociations,
  saveFileAssociation,
  deleteFileAssociation,
  getHotkeyConfig,
  saveHotkeyConfig,
  clearCommandHistory,
} from "../tauri";

const defaultProps = {
  onClose: vi.fn(),
};

describe("SettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings header", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([]);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("renders file associations section", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([]);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("File Associations")).toBeInTheDocument();
    });
  });

  it("displays existing associations", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([
      { extension: "txt", toolPath: "/usr/local/bin/code" },
    ]);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(".txt")).toBeInTheDocument();
    });
    expect(screen.getByText("/usr/local/bin/code")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([]);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("Close"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls saveFileAssociation when add form is submitted", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([]);
    vi.mocked(saveFileAssociation).mockResolvedValue(undefined);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    const extInput = screen.getByPlaceholderText("e.g. txt");
    const toolInput = screen.getByPlaceholderText("/usr/local/bin/code");

    fireEvent.change(extInput, { target: { value: "py" } });
    fireEvent.change(toolInput, { target: { value: "/usr/bin/pycharm" } });
    fireEvent.click(screen.getByText("Add Association"));

    await waitFor(() => {
      expect(saveFileAssociation).toHaveBeenCalledWith({
        extension: "py",
        toolPath: "/usr/bin/pycharm",
      });
    });
  });

  it("calls deleteFileAssociation when delete is clicked", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([
      { extension: "log", toolPath: "/usr/bin/less" },
    ]);
    vi.mocked(deleteFileAssociation).mockResolvedValue(undefined);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(".log")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Remove association"));
    await waitFor(() => {
      expect(deleteFileAssociation).toHaveBeenCalledWith("log");
    });
  });

  it("renders keyboard section", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([]);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Keyboard")).toBeInTheDocument();
    });
  });

  it("calls saveHotkeyConfig when Save Hotkeys is clicked", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([]);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    vi.mocked(saveHotkeyConfig).mockResolvedValue(undefined);
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Save Hotkeys")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Save Hotkeys"));
    await waitFor(() => {
      expect(saveHotkeyConfig).toHaveBeenCalledWith({
        previousCommand: "Shift+ArrowUp",
        nextCommand: "Shift+ArrowDown",
      });
    });
  });

  it("calls clearCommandHistory when Clear History is clicked", async () => {
    vi.mocked(listFileAssociations).mockResolvedValue([]);
    vi.mocked(getHotkeyConfig).mockResolvedValue({
      previousCommand: "Shift+ArrowUp",
      nextCommand: "Shift+ArrowDown",
    });
    vi.mocked(clearCommandHistory).mockResolvedValue(undefined);
    render(<SettingsModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Clear History")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Clear History"));
    await waitFor(() => {
      expect(clearCommandHistory).toHaveBeenCalled();
    });
  });
});
