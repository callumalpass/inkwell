import { useState } from "react";
import { useLinksPanelStore } from "../../../stores/links-panel-store";
import { useTagsPanelStore } from "../../../stores/tags-panel-store";
import { ExportDialog } from "../../export/ExportDialog";
import { NotebookSettingsDialog } from "../../settings/NotebookSettingsDialog";
import { ToolbarButton, Divider } from "./ToolbarPrimitives";

interface PageActionButtonsProps {
  currentPageId: string | null;
  notebookId: string | undefined;
  /** data-testid suffix — "compact" or omitted for full layout */
  testIdSuffix?: string;
}

export function PageActionButtons({
  currentPageId,
  notebookId,
  testIdSuffix,
}: PageActionButtonsProps) {
  const linksPanelOpen = useLinksPanelStore((s) => s.panelOpen);
  const openLinksPanel = useLinksPanelStore((s) => s.openPanel);
  const closeLinksPanel = useLinksPanelStore((s) => s.closePanel);

  const tagsPanelOpen = useTagsPanelStore((s) => s.panelOpen);
  const openTagsPanel = useTagsPanelStore((s) => s.openPanel);
  const closeTagsPanel = useTagsPanelStore((s) => s.closePanel);

  const [exportOpen, setExportOpen] = useState(false);
  const [notebookSettingsOpen, setNotebookSettingsOpen] = useState(false);

  const handleToggleLinks = () => {
    if (!currentPageId) return;
    if (linksPanelOpen) {
      closeLinksPanel();
    } else {
      closeTagsPanel();
      openLinksPanel(currentPageId);
    }
  };

  const handleToggleTags = () => {
    if (!currentPageId) return;
    if (tagsPanelOpen) {
      closeTagsPanel();
    } else {
      closeLinksPanel();
      openTagsPanel(currentPageId);
    }
  };

  const suffix = testIdSuffix ? `-${testIdSuffix}` : "";

  return (
    <>
      {currentPageId && (
        <>
          <ToolbarButton
            onClick={() => setExportOpen(true)}
            aria-label="Export page"
            data-testid={`toolbar-export${suffix}`}
          >
            Export
          </ToolbarButton>
          <Divider />
        </>
      )}

      {currentPageId && (
        <>
          <ToolbarButton
            onClick={handleToggleLinks}
            active={linksPanelOpen}
            aria-label="Page links"
            data-testid={`toolbar-links${suffix}`}
          >
            Links
          </ToolbarButton>
          <Divider />
        </>
      )}

      {currentPageId && (
        <>
          <ToolbarButton
            onClick={handleToggleTags}
            active={tagsPanelOpen}
            aria-label="Page tags"
            data-testid={`toolbar-tags${suffix}`}
          >
            Tags
          </ToolbarButton>
          <Divider />
        </>
      )}

      <ToolbarButton
        onClick={() => setNotebookSettingsOpen(true)}
        aria-label="Notebook settings"
        data-testid={`toolbar-notebook-settings${suffix}`}
      >
        {testIdSuffix === "compact" ? "Notebook Settings" : "Settings"}
      </ToolbarButton>

      {currentPageId && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          pageId={currentPageId}
          notebookId={notebookId}
        />
      )}

      <NotebookSettingsDialog
        open={notebookSettingsOpen}
        onClose={() => setNotebookSettingsOpen(false)}
      />
    </>
  );
}
