// [impl->feat~tauri-desktop-shell~1]
// [impl->arch~frontend-framework~1]
import { useState, useCallback, useEffect, useRef } from "react";
// [impl->feat~integrated-layout~1]
// [impl->req~resizable-panels~1]
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
// [impl->feat~ssh-terminal~1]
import Sidebar from "./components/Sidebar";
// [impl->dsn~terminal-component~1]
import TerminalPanel, {
  type TerminalPanelHandle,
} from "./components/TerminalPanel";
// [impl->dsn~file-tree-component~1]
import FileBrowser from "./components/FileBrowser";
// [impl->feat~connection-profiles~1]
import ConnectionModal from "./components/ConnectionModal";
import SettingsModal from "./components/SettingsModal";
import * as tauri from "./tauri";
import type { ConnectionProfile, Session } from "./types";
import "./App.css";

// [impl->feat~remote-terminal-app~1]
function App() {
  // [impl->req~multiple-terminal-tabs~1]
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<
    ConnectionProfile | undefined
  >(undefined);

  // Three-column collapse state
  const [connectionsCollapsed, setConnectionsCollapsed] = useState(false);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);

  // Panel refs for imperative collapse/expand
  const connectionsRef = useRef<ImperativePanelHandle>(null);
  const filesRef = useRef<ImperativePanelHandle>(null);
  const terminalRef = useRef<ImperativePanelHandle>(null);

  // [impl->feat~ssh-terminal~1]
  // [impl->feat~connection-profiles~1]
  const handleConnect = useCallback(async (profile: ConnectionProfile) => {
    const tempSession: Session = {
      id: crypto.randomUUID(),
      profile,
      status: "connecting",
    };
    setSessions((prev) => [...prev, tempSession]);
    setActiveSessionId(tempSession.id);
    setShowConnectionModal(false);

    try {
      // [impl->arch~backend-rust-async~1]
      const sessionId = await tauri.connect(tempSession.id, profile);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === tempSession.id
            ? { ...s, id: sessionId, status: "connected" as const }
            : s,
        ),
      );
      setActiveSessionId(sessionId);
    } catch (e) {
      // [impl->req~graceful-reconnect~1]
      setSessions((prev) =>
        prev.map((s) =>
          s.id === tempSession.id
            ? { ...s, status: "error" as const, error: String(e) }
            : s,
        ),
      );
    }
  }, []);

  // [impl->feat~ssh-terminal~1]
  const handleCloseSession = useCallback(
    async (id: string) => {
      try {
        await tauri.disconnect(id);
      } catch {
        // ignore
      }
      terminalRefs.current.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    },
    [activeSessionId],
  );

  // [impl->req~graceful-reconnect~1]
  const handleReconnect = useCallback(async (session: Session) => {
    // Clean up old session on backend
    try {
      await tauri.disconnect(session.id);
    } catch {
      // ignore
    }
    terminalRefs.current.delete(session.id);

    // Remove old session from UI
    setSessions((prev) => prev.filter((s) => s.id !== session.id));

    // Create new connecting session with same profile
    const tempSession: Session = {
      id: crypto.randomUUID(),
      profile: session.profile,
      status: "connecting",
    };
    setSessions((prev) => [...prev, tempSession]);
    setActiveSessionId(tempSession.id);

    try {
      const sessionId = await tauri.connect(tempSession.id, session.profile);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === tempSession.id
            ? { ...s, id: sessionId, status: "connected" as const }
            : s,
        ),
      );
      setActiveSessionId(sessionId);
    } catch (e) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === tempSession.id
            ? { ...s, status: "error" as const, error: String(e) }
            : s,
        ),
      );
    }
  }, []);

  // [impl->feat~connection-profiles~1]
  useEffect(() => {
    const quickConnectHandler = (e: Event) => {
      const profile = (e as CustomEvent).detail as ConnectionProfile;
      handleConnect(profile);
    };
    const editProfileHandler = (e: Event) => {
      const profile = (e as CustomEvent).detail as ConnectionProfile;
      setEditingProfile(profile);
      setShowConnectionModal(true);
    };
    window.addEventListener("aether-quick-connect", quickConnectHandler);
    window.addEventListener("aether-edit-profile", editProfileHandler);
    return () => {
      window.removeEventListener("aether-quick-connect", quickConnectHandler);
      window.removeEventListener("aether-edit-profile", editProfileHandler);
    };
  }, [handleConnect]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // [impl->req~terminal-stream-not-invoke~1]
  // Refs to terminal panels for routing backend data to the correct session.
  const terminalRefs = useRef<
    Map<string, { current: TerminalPanelHandle | null }>
  >(new Map());

  // Stable ref callback to avoid React calling it on every render
  const terminalRefCallback = useCallback(
    (el: TerminalPanelHandle | null) => {
      if (!activeSession) return;
      const entry = terminalRefs.current.get(activeSession.id);
      if (entry) {
        entry.current = el;
      } else {
        terminalRefs.current.set(activeSession.id, { current: el });
      }
    },
    [activeSession?.id],
  );

  // Toggle helpers that also call the imperative panel API
  const toggleConnections = useCallback(() => {
    const panel = connectionsRef.current;
    if (!panel) return;
    if (connectionsCollapsed) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [connectionsCollapsed]);

  const toggleFiles = useCallback(() => {
    const panel = filesRef.current;
    if (!panel) return;
    if (filesCollapsed) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [filesCollapsed]);

  const toggleTerminal = useCallback(() => {
    const panel = terminalRef.current;
    if (!panel) return;
    if (terminalCollapsed) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [terminalCollapsed]);

  // Stabilize Panel callbacks so react-resizable-panels does not re-register
  // internal handlers on every render.
  const onConnectionsCollapse = useCallback(
    () => setConnectionsCollapsed(true),
    [],
  );
  const onConnectionsExpand = useCallback(
    () => setConnectionsCollapsed(false),
    [],
  );
  const onFilesCollapse = useCallback(() => setFilesCollapsed(true), []);
  const onFilesExpand = useCallback(() => setFilesCollapsed(false), []);
  const onTerminalCollapse = useCallback(() => setTerminalCollapsed(true), []);
  const onTerminalExpand = useCallback(() => setTerminalCollapsed(false), []);

  return (
    // [impl->feat~integrated-layout~1]
    <div className="app">
      <PanelGroup
        direction="horizontal"
        style={{ width: "100%", height: "100%" }}
      >
        {/* Column 1: Connections */}
        <Panel
          ref={connectionsRef}
          defaultSize={20}
          minSize={15}
          collapsible
          collapsedSize={4}
          onCollapse={onConnectionsCollapse}
          onExpand={onConnectionsExpand}
          style={{ height: "100%", overflow: "hidden" }}
        >
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onActivateSession={setActiveSessionId}
            onCloseSession={handleCloseSession}
            onNewConnection={() => setShowConnectionModal(true)}
            collapsed={connectionsCollapsed}
            onExpand={toggleConnections}
          />
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* Column 2: Files */}
        <Panel
          ref={filesRef}
          defaultSize={25}
          minSize={15}
          collapsible
          collapsedSize={4}
          onCollapse={onFilesCollapse}
          onExpand={onFilesExpand}
          style={{ height: "100%", overflow: "hidden" }}
        >
          <FileBrowser
            session={activeSession}
            collapsed={filesCollapsed}
            onToggleCollapse={toggleFiles}
          />
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* Column 3: Terminal */}
        <Panel
          ref={terminalRef}
          defaultSize={55}
          minSize={30}
          collapsible
          collapsedSize={4}
          onCollapse={onTerminalCollapse}
          onExpand={onTerminalExpand}
          style={{ height: "100%", overflow: "hidden" }}
        >
          <TerminalPanel
            ref={terminalRefCallback}
            session={activeSession}
            collapsed={terminalCollapsed}
            onToggleCollapse={toggleTerminal}
            onOpenSettings={() => setShowSettingsModal(true)}
            onReconnect={handleReconnect}
            onCloseSession={handleCloseSession}
          />
        </Panel>
      </PanelGroup>

      {showConnectionModal && (
        <ConnectionModal
          onConnect={handleConnect}
          onClose={() => {
            setShowConnectionModal(false);
            setEditingProfile(undefined);
          }}
          initialProfile={editingProfile}
        />
      )}

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  );
}

export default App;
