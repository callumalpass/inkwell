import type { DragEvent } from "react";

export interface PageCardData {
  id: string;
  pageNumber: number;
  tags?: string[];
}

export interface PageCardProps {
  page: PageCardData;
  index: number;
  selected: boolean;
  focused: boolean;
  dragOver: boolean;
  onSelect: (pageId: string) => void;
  onOpen: (pageId: string) => void;
  onFocus: (index: number) => void;
  onDragStart: (pageId: string) => (e: DragEvent) => void;
  onDragOver: (pageId: string) => (e: DragEvent) => void;
  onDrop: (pageId: string) => (e: DragEvent) => void;
  onDragEnd: () => void;
}

export function PageCard({
  page,
  index,
  selected,
  focused,
  dragOver,
  onSelect,
  onOpen,
  onFocus,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: PageCardProps) {
  const tags = page.tags ?? [];

  return (
    <div
      draggable
      onDragStart={onDragStart(page.id)}
      onDragOver={onDragOver(page.id)}
      onDrop={onDrop(page.id)}
      onDragEnd={onDragEnd}
      onClick={() => onFocus(index)}
      className={`group relative rounded-lg border bg-white p-2 shadow-sm transition-all ${
        selected ? "border-black" : "border-gray-200"
      } ${dragOver ? "ring-2 ring-black" : ""} ${
        focused ? "ring-2 ring-blue-500 ring-offset-1" : ""
      }`}
      data-testid={`overview-page-${index}`}
      data-focused={focused}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>Page {page.pageNumber}</span>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(page.id)}
            aria-label={`Select page ${page.pageNumber}`}
          />
          Select
        </label>
      </div>
      <button
        onClick={() => onOpen(page.id)}
        className="block w-full overflow-hidden rounded-md border border-gray-200 bg-gray-100"
        aria-label={`Open page ${page.pageNumber}`}
      >
        <img
          src={`/api/pages/${page.id}/thumbnail`}
          alt={`Page ${page.pageNumber}`}
          className="h-full w-full object-contain"
        />
      </button>
      <div className="mt-2 flex flex-wrap gap-1">
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          >
            {tag}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="text-xs text-gray-400">+{tags.length - 3}</span>
        )}
      </div>
    </div>
  );
}
