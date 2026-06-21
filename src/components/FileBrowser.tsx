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
  Upload,
  Download,
  GripVertical,
} from "lucide-react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { save } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import * as tauri from "../tauri";
import type { Session, RemoteFile, FileAssociation } from "../types";

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

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "—";
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024)
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatETA(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const m = Math.ceil(seconds / 60);
  return `~${m}m`;
}

// Generate a canvas-based document icon for native drag operations.
// The CrabNebula plugin requires a valid image; passing a non-image file path panics.
function generateFileIconBase64(name: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;

  // Document body
  ctx.fillStyle = "#4f46e5";
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(48, 0);
  ctx.lineTo(56, 8);
  ctx.lineTo(56, 80);
  ctx.lineTo(8, 80);
  ctx.closePath();
  ctx.fill();

  // Folded corner
  ctx.fillStyle = "#818cf8";
  ctx.beginPath();
  ctx.moveTo(48, 0);
  ctx.lineTo(56, 8);
  ctx.lineTo(48, 8);
  ctx.closePath();
  ctx.fill();

  // File extension label
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  if (ext) {
    ctx.fillStyle = "white";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ext.slice(0, 4), 32, 48);
  }

  return canvas.toDataURL("image/png");
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

interface TransferProgress {
  active: boolean;
  type: "upload" | "download";
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  bytesTransferred: number;
  totalBytes: number;
  startTime: number;
  phase: "reading" | "uploading" | "downloading" | "writing";
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

  // Track the previous session id so we can reset path/files after a session switch.
  const lastSessionIdRef = useRef<string | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    file: null,
  });
  const [watchedFiles, setWatchedFiles] = useState<Set<string>>(new Set());
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [associations, setAssociations] = useState<FileAssociation[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [nativeDragLoading, setNativeDragLoading] = useState<string | null>(
    null,
  );

  // Transfer progress state
  const [progress, setProgress] = useState<TransferProgress>({
    active: false,
    type: "upload",
    currentFile: "",
    currentIndex: 0,
    totalFiles: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    startTime: 0,
    phase: "reading",
  });

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

  // Refs to avoid stale closures in async listeners
  const sessionRef = useRef(session);
  const pathRef = useRef(path);
  const loadFilesRef = useRef(loadFiles);
  sessionRef.current = session;
  pathRef.current = path;
  loadFilesRef.current = loadFiles;

  useEffect(() => {
    loadFiles(path);
  }, [path, loadFiles]);

  useEffect(() => {
    if (session?.id !== lastSessionIdRef.current) {
      lastSessionIdRef.current = session?.id;
      setPath("/home/" + (session?.profile.username ?? ""));
      setFiles([]);
    }
  }, [session?.id, session?.profile.username]);

  // Load file associations once on mount
  useEffect(() => {
    tauri
      .listFileAssociations()
      .then((a) => setAssociations(Array.isArray(a) ? a : []))
      .catch(console.error);
  }, []);

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

  // [impl->req~drag-drop-upload-download~1]
  // Tauri v2 on macOS intercepts OS file drops at the WKWebView native level.
  // The HTML5 drop event NEVER fires for OS drops. We MUST listen for tauri://drag-drop.
  useEffect(() => {
    let unlistenDrop: UnlistenFn | undefined;
    let unlistenEnter: UnlistenFn | undefined;
    let unlistenOver: UnlistenFn | undefined;
    let unlistenLeave: UnlistenFn | undefined;

    const setup = async () => {
      try {
        unlistenEnter = await listen("tauri://drag-enter", (event) => {
          console.log("[FileBrowser] drag-enter:", event.payload);
        });
        unlistenOver = await listen("tauri://drag-over", (event) => {
          console.log("[FileBrowser] drag-over:", event.payload);
        });
        unlistenLeave = await listen("tauri://drag-leave", () => {
          console.log("[FileBrowser] drag-leave");
        });
        unlistenDrop = await listen<{
          paths: string[];
          position: { x: number; y: number };
        }>("tauri://drag-drop", (event) => {
          console.log("[FileBrowser] drag-drop payload:", event.payload);
          const s = sessionRef.current;
          if (!s || s.status !== "connected") {
            console.log("[FileBrowser] Drop ignored: no connected session");
            return;
          }
          const droppedPaths = event.payload.paths;
          if (!droppedPaths || droppedPaths.length === 0) {
            console.log("[FileBrowser] Drop ignored: no paths");
            return;
          }
          handleTauriFileDrop(droppedPaths);
        });
        console.log("[FileBrowser] Tauri drag-drop listeners registered");
      } catch (e) {
        console.error(
          "[FileBrowser] Failed to register drag-drop listeners:",
          e,
        );
      }
    };
    setup();

    return () => {
      unlistenEnter?.();
      unlistenOver?.();
      unlistenLeave?.();
      unlistenDrop?.();
    };
  }, []); // Run once on mount; use refs for dynamic values

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
  const getToolForFile = useCallback(
    (file: RemoteFile): FileAssociation | undefined => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ext || file.is_directory) return undefined;
      return associations.find((a) => a.extension.toLowerCase() === ext);
    },
    [associations],
  );

  const handleOpenFile = useCallback(
    async (file: RemoteFile) => {
      closeContextMenu();
      setOpeningFile(file.path);
      try {
        await tauri.openRemoteFile(session!.id, file.path);
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

  const handleDownloadFile = useCallback(
    async (file: RemoteFile) => {
      if (!session || session.status !== "connected") return;
      closeContextMenu();

      const startTime = performance.now();
      setProgress({
        active: true,
        type: "download",
        currentFile: file.name,
        currentIndex: 1,
        totalFiles: 1,
        bytesTransferred: 0,
        totalBytes: file.size,
        startTime,
        phase: "downloading",
      });

      try {
        const localPath = await save({ defaultPath: file.name });
        if (!localPath) {
          setProgress((prev) => ({ ...prev, active: false }));
          return;
        }
        await tauri.downloadFile(session.id, file.path, localPath);
        setProgress((prev) => ({
          ...prev,
          bytesTransferred: file.size,
          phase: "writing",
        }));
      } catch (e) {
        console.error("Failed to download file:", e);
        alert("Failed to download file: " + String(e));
      } finally {
        setProgress((prev) => ({ ...prev, active: false }));
      }
    },
    [session?.id, session?.status, closeContextMenu],
  );

  const performNativeDrag = useCallback(async (file: RemoteFile) => {
    const s = sessionRef.current;
    if (!s || s.status !== "connected") return;
    setNativeDragLoading(file.path);
    const startTime = performance.now();
    setProgress({
      active: true,
      type: "download",
      currentFile: file.name,
      currentIndex: 1,
      totalFiles: 1,
      bytesTransferred: 0,
      totalBytes: file.size,
      startTime,
      phase: "downloading",
    });

    try {
      console.log("[FileBrowser] Downloading to temp for drag:", file.path);
      const tempPath = await tauri.downloadFileToTemp(s.id, file.path);
      console.log("[FileBrowser] Temp file ready:", tempPath);

      setProgress((prev) => ({
        ...prev,
        bytesTransferred: file.size,
        phase: "writing",
      }));

      const icon = generateFileIconBase64(file.name);
      console.log("[FileBrowser] Starting native drag with icon");
      await startDrag({
        item: [tempPath],
        icon,
        mode: "copy",
      });
      console.log("[FileBrowser] Native drag started");
    } catch (e) {
      console.error("[FileBrowser] Native drag-out failed:", e);
      alert("Failed to prepare file for drag: " + String(e));
    } finally {
      setNativeDragLoading(null);
      setProgress((prev) => ({ ...prev, active: false }));
    }
  }, []);

  // Pointer-based drag-out: detect drag gesture on file rows, download to temp,
  // then initiate a native OS drag via the CrabNebula plugin.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, file: RemoteFile) => {
      if (file.is_directory) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;

      const onPointerMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          moved = true;
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", onPointerUp);
          performNativeDrag(file);
        }
      };

      const onPointerUp = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [performNativeDrag],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, file: RemoteFile) => {
      e.dataTransfer.setData("text/plain", file.name);
      e.dataTransfer.setData("text/uri-list", "file://" + file.path);
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  const handleDoubleClick = useCallback(
    (file: RemoteFile) => {
      if (file.is_directory) {
        setPath(file.path);
      } else {
        handleOpenFile(file);
      }
    },
    [handleOpenFile],
  );

  // HTML5 drag handlers (for in-app drops and non-macOS platforms)
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (session?.status !== "connected") return;
      dragCounterRef.current += 1;
      const hasFiles = Array.from(e.dataTransfer.types).some(
        (t) => t.toLowerCase() === "files",
      );
      if (hasFiles) {
        setIsDraggingOver(true);
      }
    },
    [session?.status],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Handle Tauri native file-drop events (macOS)
  const handleTauriFileDrop = useCallback(async (droppedPaths: string[]) => {
    const s = sessionRef.current;
    if (!s || s.status !== "connected") return;
    const currentPath = pathRef.current;

    console.log("[FileBrowser] Processing dropped paths:", droppedPaths);

    const filePaths: string[] = [];
    for (const p of droppedPaths) {
      try {
        // Check if path is a file by attempting to read first byte
        // (readLocalFile returns bytes; directories would fail)
        await tauri.readLocalFile(p);
        filePaths.push(p);
      } catch (err) {
        console.log("[FileBrowser] Skipping non-file path:", p, err);
      }
    }

    if (filePaths.length === 0) {
      console.log("[FileBrowser] No valid files to upload");
      return;
    }

    const startTime = performance.now();
    setProgress({
      active: true,
      type: "upload",
      currentFile: filePaths[0].split("/").pop() || filePaths[0],
      currentIndex: 1,
      totalFiles: filePaths.length,
      bytesTransferred: 0,
      totalBytes: 0,
      startTime,
      phase: "reading",
    });

    let totalBytes = 0;
    let totalBytesRead = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const localPath = filePaths[i];
      const fileName = localPath.split("/").pop() || localPath;

      setProgress((prev) => ({
        ...prev,
        currentFile: fileName,
        currentIndex: i + 1,
        phase: "reading",
      }));

      try {
        console.log("[FileBrowser] Reading local file:", localPath);
        const bytes = await tauri.readLocalFile(localPath);
        totalBytes += bytes.length;
        totalBytesRead += bytes.length;

        const remotePath = currentPath.replace(/\/$/, "") + "/" + fileName;

        setProgress((prev) => ({
          ...prev,
          currentFile: fileName,
          currentIndex: i + 1,
          phase: "uploading",
          bytesTransferred: totalBytesRead,
          totalBytes: Math.max(prev.totalBytes, totalBytes),
        }));

        console.log("[FileBrowser] Uploading to:", remotePath);
        await tauri.writeFile(s.id, remotePath, bytes);
        console.log("[FileBrowser] Uploaded:", fileName);
      } catch (err) {
        console.error(`[FileBrowser] Failed to upload ${fileName}:`, err);
        alert(`Failed to upload ${fileName}: ${String(err)}`);
      }
    }

    setProgress((prev) => ({ ...prev, active: false }));
    loadFilesRef.current(currentPath);
  }, []);

  // HTML5 fallback drop handler (for in-app drops and other platforms)
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      if (session?.status !== "connected" || !session) return;

      const droppedFiles: File[] = [];
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          droppedFiles.push(e.dataTransfer.files[i]);
        }
      }

      if (droppedFiles.length === 0) return;

      const totalBytes = droppedFiles.reduce((sum, f) => sum + f.size, 0);
      const startTime = performance.now();
      setProgress({
        active: true,
        type: "upload",
        currentFile: droppedFiles[0].name,
        currentIndex: 1,
        totalFiles: droppedFiles.length,
        bytesTransferred: 0,
        totalBytes,
        startTime,
        phase: "reading",
      });

      let bytesTransferred = 0;

      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i];
        setProgress((prev) => ({
          ...prev,
          currentFile: file.name,
          currentIndex: i + 1,
          phase: "reading",
        }));

        try {
          const fileBytes = await readFileAsBytes(file, (loaded) => {
            setProgress((prev) => ({
              ...prev,
              bytesTransferred: bytesTransferred + loaded,
            }));
          });
          bytesTransferred += file.size;

          const remotePath = path.replace(/\/$/, "") + "/" + file.name;

          setProgress((prev) => ({
            ...prev,
            currentFile: file.name,
            currentIndex: i + 1,
            phase: "uploading",
            bytesTransferred,
          }));

          await tauri.writeFile(session.id, remotePath, fileBytes);
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          alert(`Failed to upload ${file.name}: ${String(err)}`);
        }
      }

      setProgress((prev) => ({ ...prev, active: false }));
      loadFiles(path);
    },
    [session, path, loadFiles],
  );

  const readFileAsBytes = (
    file: File,
    onProgress?: (loaded: number) => void,
  ): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(e.loaded);
        }
      };
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        resolve(bytes);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  // Compute derived progress values
  const elapsed = progress.active
    ? (performance.now() - progress.startTime) / 1000
    : 0;
  const speed = elapsed > 0 ? progress.bytesTransferred / elapsed : 0;
  const remainingBytes = Math.max(
    0,
    progress.totalBytes - progress.bytesTransferred,
  );
  const eta = speed > 0 ? remainingBytes / speed : 0;
  const percent =
    progress.totalBytes > 0
      ? Math.min(100, (progress.bytesTransferred / progress.totalBytes) * 100)
      : progress.totalFiles > 0
        ? (progress.currentIndex / progress.totalFiles) * 100
        : 0;

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
          <img
            src="/icon.svg"
            alt="Aether"
            style={{ width: 20, height: 20, flexShrink: 0 }}
          />
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
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
          position: "relative",
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
                onPointerDown={(e) => handlePointerDown(e, file)}
                onDragStart={(e) => handleDragStart(e, file)}
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
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  setHoveredFile(file.path);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  setHoveredFile(null);
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
                  {!file.is_directory && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(file);
                        }}
                        title="Download file"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          marginLeft: 4,
                          opacity: hoveredFile === file.path ? 1 : 0,
                          transition: "opacity 0.15s ease, color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--accent)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-muted)";
                        }}
                      >
                        <Download size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          performNativeDrag(file);
                        }}
                        title="Drag to desktop"
                        disabled={nativeDragLoading === file.path}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: "none",
                          border: "none",
                          color:
                            nativeDragLoading === file.path
                              ? "var(--accent)"
                              : "var(--text-muted)",
                          cursor:
                            nativeDragLoading === file.path
                              ? "wait"
                              : "pointer",
                          marginLeft: 2,
                          opacity: hoveredFile === file.path ? 1 : 0,
                          transition: "opacity 0.15s ease, color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (nativeDragLoading !== file.path) {
                            e.currentTarget.style.color = "var(--accent)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color =
                            nativeDragLoading === file.path
                              ? "var(--accent)"
                              : "var(--text-muted)";
                        }}
                      >
                        <GripVertical size={12} />
                      </button>
                    </>
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

        {/* Drag overlay */}
        {isDraggingOver && (
          <div
            className="drag-pulse"
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(99, 102, 241, 0.15)",
              border: "3px dashed var(--accent)",
              borderRadius: 12,
              margin: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              zIndex: 50,
              backdropFilter: "blur(3px)",
            }}
          >
            <div
              className="drag-bounce"
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                backgroundColor: "rgba(99, 102, 241, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid var(--accent)",
              }}
            >
              <Upload size={36} style={{ color: "var(--accent)" }} />
            </div>
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                Drop files to upload
              </span>
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                }}
              >
                Release to upload to {path}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom transfer progress bar */}
      {progress.active && (
        <div
          style={{
            borderTop: "1px solid var(--border-color)",
            borderLeft: `3px solid ${progress.type === "upload" ? "var(--accent)" : "#22c55e"}`,
            backgroundColor: "var(--bg-tertiary)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {/* Top row: icon + file info + speed/ETA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
                flex: 1,
              }}
            >
              {progress.type === "upload" ? (
                <Upload
                  size={14}
                  style={{ flexShrink: 0, color: "var(--accent)" }}
                />
              ) : (
                <Download
                  size={14}
                  style={{ flexShrink: 0, color: "#22c55e" }}
                />
              )}
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={progress.currentFile}
              >
                {progress.phase === "reading"
                  ? "Reading"
                  : progress.phase === "uploading"
                    ? "Uploading"
                    : progress.phase === "downloading"
                      ? "Downloading"
                      : "Writing"}{" "}
                {progress.currentFile}
              </span>
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--text-muted)",
                  flexShrink: 0,
                }}
              >
                ({progress.currentIndex}/{progress.totalFiles})
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {formatSpeed(speed)}
              </span>
              {eta > 0 && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {formatETA(eta)}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: "100%",
              height: 6,
              backgroundColor: "var(--bg-hover)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              className={progress.phase === "reading" ? "progress-pulse" : ""}
              style={{
                width: `${percent}%`,
                height: "100%",
                backgroundColor:
                  progress.type === "upload" ? "var(--accent)" : "#22c55e",
                borderRadius: 3,
                transition: "width 0.15s ease",
                backgroundImage:
                  progress.phase === "reading"
                    ? "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)"
                    : undefined,
                backgroundSize: "200% 100%",
              }}
            />
          </div>

          {/* Bottom row: bytes info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-muted)",
              }}
            >
              {formatSize(progress.bytesTransferred)} /{" "}
              {formatSize(progress.totalBytes)}
            </span>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              {percent.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

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
            <>
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
                {(() => {
                  const assoc = getToolForFile(contextMenu.file!);
                  if (assoc) {
                    const name = assoc.toolPath
                      .replace(/\\/g, "/")
                      .split("/")
                      .pop()
                      ?.replace(/\.app$/i, "")
                      ?.replace(/\.exe$/i, "");
                    return `Open with ${name || assoc.toolPath}`;
                  }
                  return "Open with Default App";
                })()}
              </button>
              <button
                onClick={() => handleDownloadFile(contextMenu.file!)}
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
                <Download size={14} />
                Download
              </button>
              <button
                onClick={() => {
                  closeContextMenu();
                  performNativeDrag(contextMenu.file!);
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
                <GripVertical size={14} />
                Drag to Desktop
              </button>
            </>
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
