import React, { useEffect, useState } from "react";
import {
  Monitor,
  X,
  Plus,
  Wifi,
  WifiOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  History,
  Trash2,
  Star,
  Pencil,
} from "lucide-react";
import * as tauri from "../tauri";
import type { Session, ConnectionProfile, HistoryEntry } from "../types";

interface ConnectionsPanelProps {
  sessions: Session[];
  activeSessionId: string | null;
  onActivateSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onNewConnection: () => void;
  collapsed: boolean;
  onExpand: () => void;
}

const ConnectionsPanel: React.FC<ConnectionsPanelProps> = ({
  sessions,
  activeSessionId,
  onActivateSession,
  onCloseSession,
  onNewConnection,
  collapsed,
  onExpand,
}) => {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // [impl->feat~connection-profiles~1]
  useEffect(() => {
    const fetchProfiles = () => {
      tauri
        .listProfiles()
        .then((p) => setProfiles(Array.isArray(p) ? p : []))
        .catch(console.error);
    };
    fetchProfiles();
    window.addEventListener("aether-profiles-changed", fetchProfiles);
    return () =>
      window.removeEventListener("aether-profiles-changed", fetchProfiles);
  }, []);

  // [impl->feat~session-history~1]
  useEffect(() => {
    tauri
      .listHistory()
      .then((h) => setHistory(Array.isArray(h) ? h : []))
      .catch(console.error);
  }, [sessions.length]);

  const handleHistoryConnect = (entry: HistoryEntry) => {
    const saved = profiles?.find((p) => p.id === entry.profileId);
    const profile: ConnectionProfile = {
      id: entry.profileId,
      name: entry.name,
      host: entry.host,
      port: entry.port,
      username: entry.username,
      authType: entry.authType as "password" | "key" | "agent",
      color: entry.color,
      password: saved?.password ?? entry.password,
      privateKeyPath: saved?.privateKeyPath ?? entry.privateKeyPath,
    };
    const event = new CustomEvent("aether-quick-connect", { detail: profile });
    window.dispatchEvent(event);
  };

  const handleClearHistory = async () => {
    try {
      await tauri.clearHistory();
      setHistory([]);
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await tauri.deleteProfile(id);
      window.dispatchEvent(new CustomEvent("aether-profiles-changed"));
    } catch (e) {
      console.error("Failed to delete profile:", e);
    }
  };

  const handleSaveSessionAsProfile = async (profile: ConnectionProfile) => {
    try {
      await tauri.saveProfile(profile);
      window.dispatchEvent(new CustomEvent("aether-profiles-changed"));
    } catch (e) {
      console.error("Failed to save profile:", e);
    }
  };

  const handleEditProfile = (profile: ConnectionProfile) => {
    const event = new CustomEvent("aether-edit-profile", { detail: profile });
    window.dispatchEvent(event);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // Collapsed: narrow vertical bar
  if (collapsed) {
    return (
      <aside
        className="sidebar"
        style={{
          width: "100%",
          height: "100%",
          alignItems: "center",
          padding: "8px 0",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginBottom: 8,
          }}
        >
          <Monitor size={16} color="#ffffff" />
        </div>

        <div
          style={{
            width: 24,
            height: 1,
            backgroundColor: "var(--border-color)",
            margin: "4px 0",
          }}
        />

        <IconButton onClick={onExpand} title="Expand connections">
          <ChevronRight size={18} />
        </IconButton>
        <IconButton onClick={onNewConnection} title="New connection">
          <Plus size={18} />
        </IconButton>

        <div style={{ flex: 1 }} />
      </aside>
    );
  }

  // Expanded
  return (
    <aside className="sidebar" style={{ width: "100%", height: "100%" }}>
      {/* Header with collapse + New Connection */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid var(--border-color)",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconButton onClick={onExpand} title="Collapse connections">
            <ChevronLeft size={18} />
          </IconButton>
          <span
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Connections
          </span>
        </div>
        <button
          onClick={onNewConnection}
          title="New connection"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            backgroundColor: "var(--accent)",
            color: "#ffffff",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background-color 0.15s ease, transform 0.1s ease",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent)";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.96)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <Plus size={12} />
          New
        </button>
      </div>

      {/* Active Sessions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px 8px",
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
          Sessions
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          minHeight: 0,
        }}
      >
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isSaved = profiles?.some((p) => p.id === session.profile.id);
          return (
            <ConnectionChip
              key={session.id}
              color={session.profile.color}
              name={session.profile.name}
              description={`URL: ${session.profile.host}:${session.profile.port}  User: ${session.profile.username}`}
              active={isActive}
              onClick={() => onActivateSession(session.id)}
              statusIcon={
                session.status === "connecting" ? (
                  <Loader2
                    size={12}
                    className="spin"
                    style={{ color: "var(--warning)" }}
                  />
                ) : session.status === "connected" ? (
                  <Wifi size={12} style={{ color: "var(--success)" }} />
                ) : session.status === "error" ? (
                  <WifiOff size={12} style={{ color: "var(--error)" }} />
                ) : null
              }
              actions={
                <>
                  {!isSaved && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveSessionAsProfile(session.profile);
                      }}
                      title="Save as profile"
                    >
                      <Star size={14} />
                    </IconButton>
                  )}
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseSession(session.id);
                    }}
                    title="Close session"
                  >
                    <X size={14} />
                  </IconButton>
                </>
              }
            />
          );
        })}

        {sessions.length === 0 && (
          <div
            style={{
              padding: "20px 10px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.8125rem",
            }}
          >
            No active sessions
          </div>
        )}

        {/* Session History */}
        {history?.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 14px 8px",
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <History size={12} />
                Recent
              </span>
              <IconButton onClick={handleClearHistory} title="Clear history">
                <Trash2 size={14} />
              </IconButton>
            </div>
            {history.map((entry) => (
              <ConnectionChip
                key={entry.id}
                color={entry.color}
                name={entry.name}
                description={`URL: ${entry.host}:${entry.port}  User: ${entry.username}`}
                meta={formatDate(entry.connectedAt)}
                onClick={() => handleHistoryConnect(entry)}
              />
            ))}
          </>
        )}

        {/* Saved Profiles */}
        {profiles?.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 14px 8px",
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Star size={12} />
                Saved Profiles
              </span>
            </div>
            {profiles.map((profile) => (
              <ConnectionChip
                key={profile.id}
                color={profile.color}
                name={profile.name}
                description={`URL: ${profile.host}:${profile.port}  User: ${profile.username}`}
                onClick={() => {
                  const event = new CustomEvent("aether-quick-connect", {
                    detail: profile,
                  });
                  window.dispatchEvent(event);
                }}
                actions={
                  <>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditProfile(profile);
                      }}
                      title="Edit profile"
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProfile(profile.id);
                      }}
                      title="Delete profile"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </>
                }
              />
            ))}
          </>
        )}
      </div>

      {/* Footer actions */}
    </aside>
  );
};

/* Reusable connection chip */
const ConnectionChip: React.FC<{
  color: string;
  name: string;
  description: string;
  active?: boolean;
  meta?: string;
  onClick: () => void;
  statusIcon?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({
  color,
  name,
  description,
  active,
  meta,
  onClick,
  statusIcon,
  actions,
}) => (
  <div
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      padding: "10px 12px",
      borderRadius: "var(--radius-md)",
      cursor: "pointer",
      backgroundColor: active ? "var(--bg-active)" : "var(--bg-secondary)",
      border: active
        ? "1px solid var(--accent)"
        : "1px solid var(--border-color)",
      transition: "all 0.15s ease",
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.backgroundColor = "var(--bg-hover)";
        e.currentTarget.style.borderColor = "var(--border-color)";
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
        e.currentTarget.style.borderColor = "var(--border-color)";
      }
    }}
  >
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}40`,
        marginTop: 3,
        flexShrink: 0,
      }}
    />
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={name}
        >
          {name}
        </span>
        {statusIcon}
        {meta && (
          <span
            style={{
              fontSize: "0.6875rem",
              color: "var(--text-muted)",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            {meta}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={description}
      >
        {description}
      </span>
    </div>
    {actions && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexShrink: 0,
          marginTop: -2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {actions}
      </div>
    )}
  </div>
);

/* Reusable icon button */
const IconButton: React.FC<{
  onClick: (e: React.MouseEvent) => void;
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

export default ConnectionsPanel;
