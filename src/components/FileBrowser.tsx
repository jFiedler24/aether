import React, { useState, useCallback, useEffect, useRef } from "react";
// [impl->dsn~file-tree-component~1]
import {
  Folder,
  File,
  ChevronRight,
  ExternalLink,
  Eye,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import * as tauri from "../tauri";
import type { Session, RemoteFile } from "../types";

interface FileBrowserProps {
  session: Session | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function formatSize(size: number): string {
  if (size === 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// [impl->req~sftp-filename-encoding~1]
function formatPermissions(perm: number): string {
  const toStr = (n: number) => {
    const r = n & 4 ? "r" : "-";
    const w = n & 2 ? "w" : "-";
    const x = n & 1 ? "x" : "-";
    return r + w + x;
  };
  const owner = (perm >> 6) & 7;
  const group = (perm >> 3) & 7;
  const other = perm & 7;
  return toStr(owner) + toStr(group) + toStr(other);
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  file: RemoteFile | null;
}

// [impl->feat~remote-file-browser~1]
// [impl->dsn~file-tree-component~1]
// [impl->req~remote-file-browser-copy-paste~1]
// [impl->req~drag-drop-upload-download~1]
// [impl->req~native-drag-drop-tauri~1]
// [impl->feat~file-association-tool-mapping~1]
// [impl->req~tool-mapping-config~1]
// [impl->req~temp-download-on-open~1]
const FileBrowser: React.FC<FileBrowserProps> = ({
  session,
  collapsed,
  onToggleCollapse,
}) => {
  // [impl->req~path-separator-normalization~1]
  const [path, setPath] = useState(
    "/home/" + (session?.profile.username ?? ""),
  );
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset path/files when the active session changes so we don't show the wrong host's files.
  const lastSessionIdRef = useRef<string | undefined>(undefined);
  if (session?.id !== lastSessionIdRef.current) {
    lastSessionIdRef.current = session?.id;
    setPath("/home/" + (session?.profile.username ?? ""));
    setFiles([]);
  }
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    file: null,
  });
  const [watchedFiles, setWatchedFiles] = useState<Set<string>>(new Set());
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // [impl->arch~backend-rust-async~1]
  // [impl->req~async-commands-no-block~1]
  const loadFiles = useCallback(
    async (targetPath: string) => {
      if (session?.status !== "connected") return;
      setLoading(true);
      try {
        const result = await tauri.listDirectory(session!.id, targetPath);
        setFiles(result);
      } catch (e) {
        console.error("Failed to list directory:", e);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [session?.id, session?.status],
  );

  useEffect(() => {
    loadFiles(path);
  }, [path, loadFiles]);

  // Poll watched files list every 5 seconds — only while we have a connected session
  // and the panel is visible. Stops polling when collapsed or disconnected to avoid
  // leaking IPC calls and backend work.
  useEffect(() => {
    if (!session || collapsed || session.status !== "connected") return;

    const poll = async () => {
      try {
        const watched = await tauri.listWatchedFiles();
        setWatchedFiles(new Set(watched));
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [session?.id, session?.status, collapsed]);

  const navigateTo = useCallback(
    (segment: string) => {
      if (segment === "~") {
        const home = "/home/" + (session?.profile.username ?? "");
        setPath(home);
        return;
      }
      setPath((prev) => {
        const parts = prev.split("/").filter(Boolean);
        const idx = parts.indexOf(segment);
        if (idx >= 0) {
          return "/" + parts.slice(0, idx + 1).join("/");
        }
        return prev;
      });
    },
    [session?.profile.username],
  );

  const handleDoubleClick = useCallback((file: RemoteFile) => {
    if (file.is_directory) {
      setPath(file.path);
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: RemoteFile) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = listRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.clientX;
      const y = rect ? e.clientY - rect.top : e.clientY;
      setContextMenu({ visible: true, x, y, file });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // [impl->feat~file-association-tool-mapping~1]
  // [impl->req~temp-download-on-open~1]
  const handleOpenFile = useCallback(
    async (file: RemoteFile) => {
      closeContextMenu();
      setOpeningFile(file.path);
      try {
        await tauri.openRemoteFile(session!.id, file.path);
        // File is now watched; refresh the list
        const watched = await tauri.listWatchedFiles();
        setWatchedFiles(new Set(watched));
      } catch (e) {
        console.error("Failed to open remote file:", e);
        alert("Failed to open file: " + String(e));
      } finally {
        setOpeningFile(null);
      }
    },
    [session?.id, closeContextMenu],
  );

  const pathSegments = path.split("/").filter(Boolean);

  if (collapsed) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 0",
          gap: 8,
        }}
      >
        <IconButton onClick={onToggleCollapse} title="Expand files">
          <ChevronRightIcon size={18} />
        </IconButton>
        <div
          style={{
            width: 24,
            height: 1,
            backgroundColor: "var(--border-color)",
            margin: "4px 0",
          }}
        />
        <IconButton title="Files">
          <Folder size={18} />
        </IconButton>
        <div style={{ flex: 1 }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 12px",
            borderBottom: "1px solid var(--border-color)",
            gap: 8,
          }}
        >
          <IconButton onClick={onToggleCollapse} title="Collapse files">
            <ChevronLeft size={18} />
          </IconButton>
          <span
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Files
          </span>
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
        backgroundColor: "var(--bg-secondary)",
        borderLeft: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
      onClick={closeContextMenu}
    >
      {/* Header with collapse + breadcrumb */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflow: "hidden",
        }}
      >
        <IconButton onClick={onToggleCollapse} title="Collapse files">
          <ChevronLeft size={18} />
        </IconButton>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.8125rem",
            color: "var(--text-secondary)",
            overflow: "hidden",
            flex: 1,
          }}
        >
          <button
            onClick={() => navigateTo("~")}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.8125rem",
              padding: 0,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            ~
          </button>
          {pathSegments.map((segment, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight size={12} style={{ flexShrink: 0 }} />
              <button
                onClick={() => navigateTo(segment)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                  padding: 0,
                  whiteSpace: "nowrap",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
              >
                {segment}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 64px 80px 72px",
          padding: "6px 14px",
          borderBottom: "1px solid var(--border-color)",
          fontSize: "0.6875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-muted)",
        }}
      >
        <span>Name</span>
        <span style={{ textAlign: "right" }}>Size</span>
        <span style={{ textAlign: "right" }}>Modified</span>
        <span style={{ textAlign: "right" }}>Perm</span>
      </div>

      {/* File list */}
      {/* [impl->req~file-tree-virtualization~1] */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {loading && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            Loading...
          </div>
        )}
        {!loading &&
          files.map((file) => {
            const isWatched = watchedFiles.has(file.path);
            const isOpening = openingFile === file.path;
            return (
              <div
                key={file.path}
                onDoubleClick={() => handleDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 64px 80px 72px",
                  alignItems: "center",
                  padding: "6px 14px",
                  cursor: file.is_directory ? "pointer" : "default",
                  fontSize: "0.8125rem",
                  color: "var(--text-primary)",
                  transition: "background-color 0.1s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  {file.is_directory ? (
                    <Folder
                      size={14}
                      style={{ flexShrink: 0, color: "var(--accent)" }}
                    />
                  ) : (
                    <File
                      size={14}
                      style={{ flexShrink: 0, color: "var(--text-muted)" }}
                    />
                  )}
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={file.name}
                  >
                    {file.name}
                  </span>
                  {/* [impl->feat~file-association-tool-mapping~1] */}
                  {isWatched && (
                    <span title="Watching for changes">
                      <Eye
                        size={12}
                        style={{
                          flexShrink: 0,
                          color: "#22c55e",
                          marginLeft: 4,
                        }}
                      />
                    </span>
                  )}
                  {isOpening && (
                    <span
                      style={{
                        fontSize: "0.625rem",
                        color: "var(--accent)",
                        marginLeft: 4,
                      }}
                    >
                      opening…
                    </span>
                  )}
                </div>
                <span
                  style={{
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                  }}
                >
                  {formatSize(file.size)}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                  }}
                >
                  {formatDate(file.modified)}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {formatPermissions(file.permissions)}
                </span>
              </div>
            );
          })}
      </div>

      {/* Context menu */}
      {/* [impl->feat~file-association-tool-mapping~1] */}
      {contextMenu.visible && contextMenu.file && (
        <div
          style={{
            position: "absolute",
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 100,
            minWidth: 180,
            padding: "4px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.file.is_directory && (
            <button
              onClick={() => handleOpenFile(contextMenu.file!)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 12px",
                background: "none",
                border: "none",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: "0.8125rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <ExternalLink size={14} />
              Open with Default App
            </button>
          )}
          <button
            onClick={() => {
              closeContextMenu();
              handleDoubleClick(contextMenu.file!);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 12px",
              background: "none",
              border: "none",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: "0.8125rem",
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <Folder size={14} />
            {contextMenu.file.is_directory ? "Open" : "Show in Folder"}
          </button>
        </div>
      )}
    </div>
  );
};

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

export default FileBrowser;
