import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
// [impl->dsn~terminal-component~1]
import { Terminal } from "@xterm/xterm";
// [impl->req~xterm-fit-on-resize~1]
import { FitAddon } from "@xterm/addon-fit";
import {
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Settings,
  Terminal as TerminalIcon,
  History,
  WifiOff,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { sendData } from "../tauri";
import * as tauri from "../tauri";
import type { Session, CommandHistoryEntry } from "../types";
// [impl->req~terminal-emulation~1]
// [impl->req~terminal-copy-paste~1]
import "@xterm/xterm/css/xterm.css";

interface TerminalPanelProps {
  session: Session | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  onReconnect?: (session: Session) => void;
  onCloseSession?: (sessionId: string) => void;
}

// [impl->req~terminal-log-rolling-buffer~1]
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB

export interface TerminalPanelHandle {
  appendData: (data: string) => void;
  pasteCommand: (command: string) => void;
}

// [impl->dsn~terminal-component~1]
// [impl->req~terminal-emulation~1]
const TerminalPanel = forwardRef<TerminalPanelHandle, TerminalPanelProps>(
  (
    {
      session,
      collapsed,
      onToggleCollapse,
      onOpenSettings,
      onReconnect,
      onCloseSession,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    // [impl->req~terminal-log-rolling-buffer~1]
    const logChunksRef = useRef<string[]>([]);
    const logByteCountRef = useRef(0);

    const [logBytes, setLogBytes] = useState(0);
    const [activeTab, setActiveTab] = useState<"terminal" | "history">(
      "terminal",
    );
    const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>(
      [],
    );

    // Ref to always access current session without stale closures
    const sessionRef = useRef(session);
    sessionRef.current = session;

    // Reset log buffer whenever the session identity changes so old
    // session data does not bleed into a new one.
    const lastSessionIdRef = useRef<string | undefined>(undefined);
    if (session?.id !== lastSessionIdRef.current) {
      lastSessionIdRef.current = session?.id;
      logChunksRef.current = [];
      logByteCountRef.current = 0;
      setLogBytes(0);
      setActiveTab("terminal");
    }

    // [impl->feat~cross-session-command-history~1]
    const inputBufferRef = useRef("");

    // [impl->req~terminal-log-rolling-buffer~1]
    const appendToBuffer = (data: string) => {
      if (!data) return;
      const bytes = new TextEncoder().encode(data).length;
      logChunksRef.current.push(data);
      logByteCountRef.current += bytes;

      // Trim from front when over 5MB
      while (
        logByteCountRef.current > MAX_LOG_BYTES &&
        logChunksRef.current.length > 0
      ) {
        const removed = logChunksRef.current.shift()!;
        logByteCountRef.current -= new TextEncoder().encode(removed).length;
      }
      setLogBytes(logByteCountRef.current);
    };

    // [impl->req~terminal-log-save~1]
    const handleSaveLog = async () => {
      const buffer = logChunksRef.current.join("");
      if (!buffer || !session) return;
      const defaultName = `aether-${session.profile.name}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.log`;
      try {
        const tauri = await import("../tauri");
        await tauri.saveLogDialog(buffer, defaultName);
      } catch (e) {
        // ignore cancel / errors
        console.warn("Save log failed:", e);
      }
    };

    // [impl->req~terminal-log-rolling-buffer~1]
    const handleClearBuffer = () => {
      logChunksRef.current = [];
      logByteCountRef.current = 0;
      setLogBytes(0);
      terminalRef.current?.clear();
    };

    const handleClearHistory = useCallback(async () => {
      try {
        await tauri.clearCommandHistory();
        setCommandHistory([]);
      } catch (e) {
        console.error("Failed to clear history:", e);
      }
    }, []);

    const handlePasteCommand = useCallback(
      (command: string, execute = false) => {
        setActiveTab("terminal");
        const terminal = terminalRef.current;
        if (!terminal) return;
        try {
          (terminal as any).paste?.(command);
        } catch {
          terminal.write(command);
          if (sessionRef.current?.status === "connected") {
            const bytes = Array.from(command).map(
              (c) => c.charCodeAt(0) & 0xff,
            );
            sendData(sessionRef.current.id, bytes).catch(() => {});
          }
        }
        if (execute && sessionRef.current?.status === "connected") {
          // Send Enter (\r) to execute the command
          sendData(sessionRef.current.id, [0x0d]).catch(() => {});
        }
      },
      [],
    );

    // Load command history
    const loadHistory = useCallback(async () => {
      try {
        const h = await tauri.listCommandHistory();
        setCommandHistory(Array.isArray(h) ? h : []);
      } catch (e) {
        console.error("Failed to load history:", e);
      }
    }, []);

    useEffect(() => {
      loadHistory();
      const handler = () => loadHistory();
      window.addEventListener("aether-history-changed", handler);
      return () =>
        window.removeEventListener("aether-history-changed", handler);
    }, [loadHistory]);

    useImperativeHandle(
      ref,
      () => ({
        appendData: (data: string) => {
          appendToBuffer(data);
          terminalRef.current?.write(data);
        },
        pasteCommand: (command: string) => {
          handlePasteCommand(command);
        },
      }),
      [handlePasteCommand],
    );

    // Effect manages the xterm lifecycle. It MUST re-run when:
    // - session?.id changes (different SSH session)
    // - collapsed changes (panel hidden/shown — DOM node removed/recreated)
    useEffect(() => {
      // Do not create a terminal when collapsed or when there is no session.
      // The DOM node is not rendered in those states.
      if (!containerRef.current || collapsed || !session) return;

      // Guard against updates after unmount or during async setup
      let mounted = true;
      const unlistenRef = { current: undefined as UnlistenFn | undefined };
      const disconnectUnlistenRef = {
        current: undefined as UnlistenFn | undefined,
      };

      // [impl->req~terminal-emulation~1]
      const terminal = new Terminal({
        cursorBlink: true,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
        theme: {
          background: "#0f1117",
          foreground: "#e2e4ea",
          cursor: "#6366f1",
          selectionBackground: "#2d3042",
          black: "#0f1117",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#f59e0b",
          blue: "#6366f1",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#e2e4ea",
          brightBlack: "#5a5e6e",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#fbbf24",
          brightBlue: "#8184f8",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#f1f5f9",
        },
        scrollback: 10000,
      });

      // [impl->req~xterm-fit-on-resize~1]
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminal.open(containerRef.current);
      fitAddon.fit();

      // [impl->feat~ssh-terminal~1]
      // Send keystrokes to the SSH backend as raw bytes.
      // Use sessionRef to avoid stale closure.
      // Also track the current input line for command history.
      terminal.onData((data) => {
        if (sessionRef.current?.status !== "connected") return;
        const bytes = Array.from(data).map((c) => c.charCodeAt(0) & 0xff);
        sendData(sessionRef.current.id, bytes).catch(() => {});

        // [impl->feat~cross-session-command-history~1]
        // Track input for history — handles escape sequences, Unicode, and control chars.
        let escState: "none" | "esc" | "csi" = "none";
        for (const char of data) {
          const code = char.charCodeAt(0);

          // Escape sequence state machine
          if (escState === "csi") {
            if (code >= 0x40 && code <= 0x7e) {
              escState = "none";
            }
            continue;
          }
          if (escState === "esc") {
            if (char === "[") {
              escState = "csi";
            } else {
              escState = "none";
            }
            continue;
          }
          if (code === 0x1b) {
            escState = "esc";
            continue;
          }

          if (char === "\r" || char === "\n") {
            const cmd = inputBufferRef.current.trim();
            if (cmd) {
              tauri.addCommandHistory(cmd).catch(() => {});
              window.dispatchEvent(new CustomEvent("aether-history-changed"));
            }
            inputBufferRef.current = "";
          } else if (char === "\x7f" || char === "\x08") {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          } else if (char === "\x03" || char === "\x04") {
            inputBufferRef.current = "";
          } else if (code < 0x20 || code === 0x7f) {
            // Skip other control characters
          } else {
            inputBufferRef.current += char;
          }
        }
      });

      // Listen for SSH data from the backend.
      // Store unlisten in a ref so cleanup always works even if setup is still pending.
      const setupListener = async () => {
        const unlisten = await listen<number[]>(
          `ssh-data-${session.id}`,
          (event) => {
            if (!mounted) return;
            const bytes = new Uint8Array(event.payload);
            const text = new TextDecoder().decode(bytes);
            terminal.write(text);
            appendToBuffer(text);
          },
        );
        if (mounted) {
          unlistenRef.current = unlisten;
        } else {
          unlisten();
        }
      };
      setupListener();

      // Listen for unexpected disconnection from the backend
      const setupDisconnectListener = async () => {
        const unlisten = await listen(`ssh-disconnected-${session.id}`, () => {
          if (!mounted) return;
          terminal.writeln(
            "\r\n\x1b[1;31mConnection closed by remote host.\x1b[0m",
          );
        });
        if (mounted) {
          disconnectUnlistenRef.current = unlisten;
        } else {
          unlisten();
        }
      };
      setupDisconnectListener();

      // Write welcome banner every time this effect runs (i.e. when session.id changes)
      const welcomeLines = [
        `\x1b[1;34mWelcome to Aether Terminal\x1b[0m`,
        `Session: \x1b[1m${session.profile.name}\x1b[0m`,
        `Host: \x1b[36m${session.profile.host}:${session.profile.port}\x1b[0m`,
        // [impl->req~profile-fields~1]
        // Username displayed exactly as entered (case-sensitive).
        `User: \x1b[33m${session.profile.username}\x1b[0m`,
        ``,
        `\x1b[90mConnecting...\x1b[0m`,
      ];
      welcomeLines.forEach((line) => {
        terminal.writeln(line);
        appendToBuffer(line + "\r\n");
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // [impl->req~xterm-fit-on-resize~1]
      const handleResize = () => {
        fitAddon.fit();
      };

      window.addEventListener("resize", handleResize);

      return () => {
        mounted = false;
        unlistenRef.current?.();
        disconnectUnlistenRef.current?.();
        window.removeEventListener("resize", handleResize);
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
      };
    }, [session?.id, collapsed]);

    // Refit terminal when switching back to terminal tab
    useEffect(() => {
      if (
        activeTab === "terminal" &&
        terminalRef.current &&
        fitAddonRef.current
      ) {
        // Small delay to let the DOM update
        const id = setTimeout(() => fitAddonRef.current?.fit(), 50);
        return () => clearTimeout(id);
      }
    }, [activeTab]);

    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const isDisconnected = session?.status === "error";
    const isConnecting = session?.status === "connecting";

    // Collapsed: narrow vertical bar
    if (collapsed) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "var(--bg-primary)",
            borderLeft: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8px 0",
            gap: 8,
          }}
        >
          <IconButton onClick={onToggleCollapse} title="Expand terminal">
            <ChevronLeft size={18} />
          </IconButton>
          <div
            style={{
              width: 24,
              height: 1,
              backgroundColor: "var(--border-color)",
              margin: "4px 0",
            }}
          />
          <IconButton title="Terminal">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </IconButton>
          <div style={{ flex: 1 }} />
        </div>
      );
    }

    // No session
    if (!session) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
            backgroundColor: "var(--bg-primary)",
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 36,
              minHeight: 36,
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              gap: 8,
              backgroundColor: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <IconButton onClick={onToggleCollapse} title="Collapse terminal">
              <ChevronRight size={18} />
            </IconButton>
            <span
              style={{
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Terminal
            </span>
            <div style={{ flex: 1 }} />
            <IconButton onClick={onOpenSettings} title="Settings">
              <Settings size={16} />
            </IconButton>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: "0.875rem",
            }}
          >
            No active connection
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        {/* Terminal tab bar */}
        <div
          style={{
            height: 36,
            minHeight: 36,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 8,
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <IconButton onClick={onToggleCollapse} title="Collapse terminal">
            <ChevronRight size={18} />
          </IconButton>

          {/* Tabs next to session name */}
          <TabButton
            active={activeTab === "terminal"}
            onClick={() => setActiveTab("terminal")}
            icon={<TerminalIcon size={14} />}
            label="Terminal"
          />
          <TabButton
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            icon={<History size={14} />}
            label="History"
          />

          {/* Session chip */}
          {activeTab === "terminal" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                backgroundColor: "var(--bg-primary)",
                borderRadius: "6px 6px 0 0",
                borderTop: "1px solid var(--border-color)",
                borderLeft: "1px solid var(--border-color)",
                borderRight: "1px solid var(--border-color)",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: isDisconnected
                    ? "var(--error)"
                    : session.profile.color,
                  boxShadow: isDisconnected
                    ? "0 0 6px var(--error)"
                    : `0 0 6px ${session.profile.color}40`,
                }}
              />
              <span>
                {isDisconnected
                  ? "Disconnected"
                  : isConnecting
                    ? "Connecting…"
                    : session.profile.name}
              </span>
              {isConnecting && (
                <Loader2
                  size={12}
                  className="spin"
                  style={{ color: "var(--warning)" }}
                />
              )}
              {isDisconnected && (
                <WifiOff size={12} style={{ color: "var(--error)" }} />
              )}
            </div>
          )}

          <div style={{ flex: 1 }} />

          <IconButton onClick={onOpenSettings} title="Settings">
            <Settings size={16} />
          </IconButton>

          {/* [impl->req~terminal-log-save~1] */}
          <span
            style={{
              fontSize: "0.6875rem",
              color: "var(--text-muted)",
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            }}
            title="Rolling buffer size (max 5 MB)"
          >
            {formatBytes(logBytes)} / 5 MB
          </span>

          <button
            type="button"
            onClick={handleSaveLog}
            title="Save terminal log"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-color)",
              borderRadius: 4,
              color: "var(--text-muted)",
              fontSize: "0.75rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Save size={12} />
            Save Log
          </button>

          <button
            type="button"
            onClick={handleClearBuffer}
            title="Clear terminal & buffer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-color)",
              borderRadius: 4,
              color: "var(--text-muted)",
              fontSize: "0.75rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>

        {/* Error banner */}
        {session.status === "error" && session.error && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderBottom: "1px solid var(--error)",
              color: "var(--error)",
              fontSize: "0.8125rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 600 }}>Connection failed:</span>
            <span>{session.error}</span>
          </div>
        )}

        {/* Terminal content area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Terminal container - always mounted so xterm.js stays alive; hidden when History is active */}
          <div
            ref={containerRef}
            style={{
              position: "absolute",
              inset: 0,
              padding: 0,
              overflow: "hidden",
              display: activeTab === "terminal" ? "block" : "none",
            }}
          />

          {/* Disconnected overlay */}
          {isDisconnected && activeTab === "terminal" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(15, 17, 23, 0.82)",
                backdropFilter: "blur(3px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                zIndex: 20,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <WifiOff size={24} style={{ color: "var(--error)" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 4,
                  }}
                >
                  Connection lost
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-muted)",
                    maxWidth: 320,
                    lineHeight: 1.4,
                  }}
                >
                  {session.error ||
                    "The SSH connection was closed unexpectedly."}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => onReconnect?.(session)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    backgroundColor: "var(--accent)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--accent-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--accent)";
                  }}
                >
                  <RotateCcw size={14} />
                  Reconnect
                </button>
                <button
                  onClick={() => onCloseSession?.(session.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  <X size={14} />
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* History - only rendered when active */}
        {activeTab === "history" && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                }}
              >
                Command History
              </span>
              <button
                onClick={handleClearHistory}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  background: "none",
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  cursor: "pointer",
                  padding: "3px 8px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--error)";
                  e.currentTarget.style.borderColor = "var(--error)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.borderColor = "var(--border-color)";
                }}
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
            {commandHistory.length === 0 && (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.875rem",
                }}
              >
                No commands yet. Type in the terminal and press Enter.
              </div>
            )}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {[...commandHistory].reverse().map((entry, idx) => (
                <div
                  key={commandHistory.length - 1 - idx}
                  onClick={() => handlePasteCommand(entry.command)}
                  onDoubleClick={() => handlePasteCommand(entry.command, true)}
                  title="Click to paste, double-click to execute"
                  style={{
                    padding: "8px 14px",
                    cursor: "pointer",
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    fontSize: "0.8125rem",
                    color: "var(--text-primary)",
                    borderBottom: "1px solid var(--border-color)",
                    transition: "background-color 0.1s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    style={{
                      color: "var(--accent)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      minWidth: 28,
                      textAlign: "right",
                    }}
                  >
                    {commandHistory.length - idx}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.command}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);

/* Tab button */
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      backgroundColor: active ? "var(--bg-primary)" : "transparent",
      border: active
        ? "1px solid var(--border-color)"
        : "1px solid transparent",
      borderBottom: active
        ? "1px solid var(--bg-primary)"
        : "1px solid transparent",
      borderRadius: "6px 6px 0 0",
      color: active ? "var(--text-primary)" : "var(--text-muted)",
      fontSize: "0.8125rem",
      fontWeight: 500,
      cursor: "pointer",
      marginBottom: -1,
      position: "relative",
      zIndex: 1,
    }}
  >
    {icon}
    {label}
  </button>
);

/* Reusable icon button */
const IconButton: React.FC<{
  onClick?: (e: React.MouseEvent) => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: "var(--radius-sm)",
      backgroundColor: active ? "var(--bg-active)" : "transparent",
      color: active ? "var(--accent)" : "var(--text-secondary)",
      border: "none",
      cursor: "pointer",
      transition: "all 0.15s ease",
      flexShrink: 0,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      e.currentTarget.style.color = active
        ? "var(--accent)"
        : "var(--text-primary)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = active
        ? "var(--bg-active)"
        : "transparent";
      e.currentTarget.style.color = active
        ? "var(--accent)"
        : "var(--text-secondary)";
    }}
  >
    {children}
  </button>
);

TerminalPanel.displayName = "TerminalPanel";
export default TerminalPanel;
