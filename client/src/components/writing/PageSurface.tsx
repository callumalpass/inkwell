import { useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { StrokeCanvas } from "./StrokeCanvas";
import { ActiveStrokeOverlay } from "./ActiveStrokeOverlay";
import { DrawingLayer } from "./DrawingLayer";
import { EraserCursor } from "./EraserCursor";
import { PageBackground, type GridType } from "./PageBackground";
import { InlineLinkEditor } from "./InlineLinkEditor";
import type { InlineLink, InlineLinkRect } from "../../api/pages";
import type { Stroke } from "../../api/strokes";
import type { StrokeData } from "../../lib/stroke-renderer";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import { StrokeSpatialIndex } from "../../lib/spatial-index";
import { createInlineLinkId } from "../../lib/inline-links";
import { showError, showSuccess } from "../../stores/toast-store";

const EMPTY: Stroke[] = [];
const ERASE_THRESHOLD = 20;

interface PageSurfaceProps {
  pageId: string;
  gridType?: GridType;
  lineSpacing?: number;
}

type EditorState =
  | {
      mode: "create";
      rect: InlineLinkRect;
    }
  | {
      mode: "edit";
      linkId: string;
    };

export function PageSurface({
  pageId,
  gridType = "none",
  lineSpacing,
}: PageSurfaceProps) {
  const { notebookId: routeNotebookId } = useParams<{ notebookId: string }>();
  const navigate = useNavigate();

  const pages = useNotebookPagesStore((s) => s.pages);
  const updatePageInlineLinks = useNotebookPagesStore((s) => s.updatePageInlineLinks);
  const setCurrentPageIndex = useNotebookPagesStore((s) => s.setCurrentPageIndex);

  const savedStrokes = usePageStore((s) => s.strokesByPage[pageId] ?? EMPTY);
  const pendingStrokes = useDrawingStore(
    (s) => s.pendingStrokesByPage[pageId] ?? EMPTY,
  );
  const tool = useDrawingStore((s) => s.tool);

  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [linkPreviewRect, setLinkPreviewRect] = useState<InlineLinkRect | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  const currentPage = useMemo(
    () => pages.find((page) => page.id === pageId),
    [pages, pageId],
  );
  const inlineLinks = currentPage?.inlineLinks ?? [];

  const committedStrokes: StrokeData[] = useMemo(
    () => [...savedStrokes, ...pendingStrokes],
    [savedStrokes, pendingStrokes],
  );

  const spatialIndex = useMemo(
    () => StrokeSpatialIndex.fromStrokes(committedStrokes),
    [committedStrokes],
  );

  const highlightedStrokeId = useMemo(() => {
    if (tool !== "eraser" || !cursorPosition) return null;
    const hit = spatialIndex.queryPoint(cursorPosition.x, cursorPosition.y, ERASE_THRESHOLD);
    return hit?.id ?? null;
  }, [tool, cursorPosition, spatialIndex]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== "eraser") return;
    if (e.pointerType !== "pen" && e.pointerType !== "mouse") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT;
    setCursorPosition({ x, y });
  }, [tool]);

  const handlePointerLeave = useCallback(() => {
    setCursorPosition(null);
  }, []);

  const openLink = useCallback(
    (link: InlineLink) => {
      if (link.target.type === "url") {
        window.open(link.target.url, "_blank", "noopener,noreferrer");
        return;
      }

      const targetNotebookId = link.target.notebookId;
      if (!targetNotebookId) return;

      const targetPageId = link.target.pageId;
      if (routeNotebookId === targetNotebookId) {
        const targetIndex = pages.findIndex((page) => page.id === targetPageId);
        if (targetIndex >= 0) {
          setCurrentPageIndex(targetIndex);
        }
      }

      navigate(`/notebook/${targetNotebookId}/page/${targetPageId}`, { replace: true });
    },
    [navigate, routeNotebookId, pages, setCurrentPageIndex],
  );

  const handleFollowInlineLink = useCallback(
    (linkId: string) => {
      const link = inlineLinks.find((item) => item.id === linkId);
      if (!link) return;
      openLink(link);
    },
    [inlineLinks, openLink],
  );

  const handleCreateInlineLinkRect = useCallback((rect: InlineLinkRect) => {
    setEditorState({ mode: "create", rect });
  }, []);

  const handleEditInlineLink = useCallback((linkId: string) => {
    const link = inlineLinks.find((item) => item.id === linkId);
    if (!link) return;
    setEditorState({ mode: "edit", linkId: link.id });
  }, [inlineLinks]);

  const handleSaveInlineLink = useCallback(
    async (target: InlineLink["target"]) => {
      if (!editorState) return;

      const now = new Date().toISOString();
      let nextLinks: InlineLink[];

      if (editorState.mode === "create") {
        const newLink: InlineLink = {
          id: createInlineLinkId(),
          rect: editorState.rect,
          target,
          createdAt: now,
          updatedAt: now,
        };
        nextLinks = [...inlineLinks, newLink];
      } else {
        nextLinks = inlineLinks.map((link) =>
          link.id === editorState.linkId
            ? { ...link, target, updatedAt: now }
            : link,
        );
      }

      await updatePageInlineLinks(pageId, nextLinks);
      showSuccess("Inline link saved");
    },
    [editorState, inlineLinks, pageId, updatePageInlineLinks],
  );

  const handleDeleteInlineLink = useCallback(async () => {
    if (!editorState || editorState.mode !== "edit") return;
    const nextLinks = inlineLinks.filter((link) => link.id !== editorState.linkId);
    await updatePageInlineLinks(pageId, nextLinks);
    showSuccess("Inline link removed");
  }, [editorState, inlineLinks, pageId, updatePageInlineLinks]);

  const editorInitialLink =
    editorState?.mode === "edit"
      ? inlineLinks.find((link) => link.id === editorState.linkId) ?? null
      : null;

  const currentNotebookId = routeNotebookId ?? currentPage?.notebookId ?? "";

  return (
    <>
      <div
        className="relative bg-white shadow-sm"
        style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <PageBackground gridType={gridType} lineSpacing={lineSpacing} />
        <StrokeCanvas strokes={committedStrokes} highlightedStrokeId={highlightedStrokeId} />

        <InlineLinkOverlay
          links={inlineLinks}
          previewRect={linkPreviewRect}
          showStrong={tool === "link"}
        />

        <ActiveStrokeOverlay pageId={pageId} />
        <DrawingLayer
          pageId={pageId}
          inlineLinks={inlineLinks}
          onInlineLinkPreview={setLinkPreviewRect}
          onInlineLinkCreate={handleCreateInlineLinkRect}
          onInlineLinkEdit={handleEditInlineLink}
          onInlineLinkFollow={handleFollowInlineLink}
        />
        <EraserCursor position={cursorPosition} />
      </div>

      <InlineLinkEditor
        open={editorState !== null}
        mode={editorState?.mode ?? "create"}
        currentNotebookId={currentNotebookId}
        initialLink={editorInitialLink}
        onClose={() => {
          setEditorState(null);
          setLinkPreviewRect(null);
        }}
        onSave={async (target) => {
          try {
            await handleSaveInlineLink(target);
          } catch (err) {
            showError("Failed to save inline link");
            throw err;
          }
        }}
        onDelete={
          editorState?.mode === "edit"
            ? async () => {
                try {
                  await handleDeleteInlineLink();
                } catch (err) {
                  showError("Failed to remove inline link");
                  throw err;
                }
              }
            : undefined
        }
      />
    </>
  );
}

interface InlineLinkOverlayProps {
  links: InlineLink[];
  previewRect: InlineLinkRect | null;
  showStrong: boolean;
}

function InlineLinkOverlay({ links, previewRect, showStrong }: InlineLinkOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {links.map((link) => (
        <InlineLinkRectOverlay
          key={link.id}
          rect={link.rect}
          label={inlineLinkLabel(link)}
          strong={showStrong}
        />
      ))}
      {previewRect && (
        <InlineLinkRectOverlay
          rect={previewRect}
          label="New link"
          strong
          preview
        />
      )}
    </div>
  );
}

interface InlineLinkRectOverlayProps {
  rect: InlineLinkRect;
  label: string;
  strong: boolean;
  preview?: boolean;
}

function InlineLinkRectOverlay({ rect, label, strong, preview = false }: InlineLinkRectOverlayProps) {
  return (
    <div
      className={`absolute rounded-sm ${preview ? "border-2 border-dashed" : "border"} ${
        strong
          ? "border-blue-500 bg-blue-100/10"
          : "border-blue-300/70 bg-blue-100/5"
      }`}
      style={{
        left: `${(rect.x / PAGE_WIDTH) * 100}%`,
        top: `${(rect.y / PAGE_HEIGHT) * 100}%`,
        width: `${(rect.width / PAGE_WIDTH) * 100}%`,
        height: `${(rect.height / PAGE_HEIGHT) * 100}%`,
      }}
    >
      <span
        className={`absolute -top-5 left-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
          strong
            ? "bg-blue-600 text-white"
            : "bg-blue-100 text-blue-700"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function inlineLinkLabel(link: InlineLink): string {
  if (link.target.type === "url") {
    return link.target.label?.trim() || "External link";
  }
  return link.target.label?.trim() || "Page link";
}
