# Inkwell

A self-hosted handwriting application for Boox e-ink devices. Captures handwritten notes to an infinite canvas composed of pages, with automatic transcription and local file storage.

---

## Overview

Inkwell is a web application that runs on a local server (minipc) and is accessed via Chrome on a Boox e-ink tablet. It provides a writing surface for capturing handwritten notes, organised into notebooks containing pages arranged on a 2D infinite canvas.

The application leverages [boox-rapid-draw](https://github.com/sergeylappo/boox-rapid-draw) for low-latency inking. This Android app intercepts stylus input and renders strokes directly to the e-ink layer, providing instant visual feedback. Inkwell receives the stroke events through standard pointer events and persists them to the filesystem.

### Core Principles

- **Local-first**: All data stored as files on the minipc, no cloud dependencies
- **Simple persistence**: JSON files and markdown, easily backed up and grepped
- **Transcription pipeline**: Pages are automatically sent to Gemini for handwriting recognition
- **Two views**: Sequential notebook view and spatial infinite canvas view of the same underlying data

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Boox Tablet                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              boox-rapid-draw (overlay)                │  │
│  │         Renders strokes to e-ink layer instantly      │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Chrome Browser                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              Inkwell Frontend                   │  │  │
│  │  │  - Receives pointer events                      │  │  │
│  │  │  - Renders stroke playback (non-realtime)       │  │  │
│  │  │  - Canvas navigation (pan/zoom)                 │  │  │
│  │  │  - Page management UI                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         MiniPC                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Inkwell Backend                       │  │
│  │  - Express/Fastify server                             │  │
│  │  - File system operations                             │  │
│  │  - Transcription job queue                            │  │
│  │  - PDF export                                         │  │
│  │  - Thumbnail generation                               │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   File Storage                        │  │
│  │  /data/inkwell/notebooks/{id}/pages/{id}/...          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API calls (transcription)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Gemini 3 API                           │
│         gemini-3-flash-preview (handwriting OCR)            │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Directory Structure

```
/data/inkwell/
├── config.json
└── notebooks/
    └── {notebook-id}/
        ├── meta.json
        └── pages/
            └── {page-id}/
                ├── meta.json
                ├── strokes.json
                ├── transcription.md
                └── thumbnail.png (generated)
```

### config.json

Global application configuration.

```json
{
  "version": 1,
  "gemini": {
    "apiKey": "...",
    "model": "gemini-3-flash-preview",
    "thinkingLevel": "low",
    "mediaResolution": "media_resolution_high"
  },
  "defaultPageSize": {
    "width": 1404,
    "height": 1872
  },
  "autoTranscribe": true,
  "transcribeDelayMs": 5000,
  "markdown": {
    "frontmatter": {
      "enabled": true,
      "template": {
        "title": "{{transcription.firstLine}}",
        "date": "{{page.created}}",
        "modified": "{{page.modified}}",
        "tags": "{{page.tags}}",
        "notebook": "{{notebook.name}}",
        "page_id": "{{page.id}}"
      }
    },
    "sync": {
      "enabled": false,
      "destination": "/path/to/target/directory",
      "filenameTemplate": "{{notebook.name}}/{{page.seq}}-{{page.id}}.md",
      "syncOnTranscription": true,
      "syncOnManual": true
    }
  }
}
```

**Markdown configuration:**

| Field | Type | Description |
|-------|------|-------------|
| markdown.frontmatter.enabled | boolean | Whether to prepend YAML frontmatter to transcription markdown files |
| markdown.frontmatter.template | object | Key-value pairs for frontmatter. Values support template variables (see below) |
| markdown.sync.enabled | boolean | Whether to copy markdown files to an external directory |
| markdown.sync.destination | string | Absolute path on the server where markdown files are copied |
| markdown.sync.filenameTemplate | string | Template for the output filename, relative to destination |
| markdown.sync.syncOnTranscription | boolean | Automatically sync when transcription completes |
| markdown.sync.syncOnManual | boolean | Allow manual sync trigger via API |

**Template variables:**

| Variable | Description |
|----------|-------------|
| `{{page.id}}` | Page ID |
| `{{page.created}}` | Page creation date (ISO 8601) |
| `{{page.modified}}` | Page last modified date (ISO 8601) |
| `{{page.seq}}` | Page sequence number |
| `{{page.tags}}` | Page tags as YAML array |
| `{{notebook.id}}` | Notebook ID |
| `{{notebook.name}}` | Notebook name |
| `{{transcription.firstLine}}` | First line of the transcription content |

### Notebook meta.json

```json
{
  "id": "nb_a1b2c3d4",
  "name": "Project Notes",
  "created": "2025-01-28T10:00:00Z",
  "modified": "2025-01-28T14:30:00Z",
  "settings": {
    "defaultTool": "pen",
    "defaultColor": "#000000",
    "defaultStrokeWidth": 2,
    "gridType": "none"
  }
}
```

### Page meta.json

```json
{
  "id": "pg_x1y2z3",
  "notebookId": "nb_a1b2c3d4",
  "created": "2025-01-28T10:05:00Z",
  "modified": "2025-01-28T10:45:00Z",
  "canvas": {
    "x": 0,
    "y": 0,
    "width": 1404,
    "height": 1872
  },
  "seq": 1,
  "links": ["pg_abc123", "pg_def456"],
  "tags": ["meeting", "project-x"],
  "transcription": {
    "status": "complete",
    "lastAttempt": "2025-01-28T10:46:00Z",
    "error": null
  }
}
```

**Field definitions:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier, prefixed with `pg_` |
| notebookId | string | Parent notebook reference |
| created | ISO 8601 | Creation timestamp |
| modified | ISO 8601 | Last modification timestamp |
| canvas.x | number | X position on infinite canvas (pixels) |
| canvas.y | number | Y position on infinite canvas (pixels) |
| canvas.width | number | Page width in pixels |
| canvas.height | number | Page height in pixels |
| seq | number | Sequential order for notebook view |
| links | string[] | Array of linked page IDs |
| tags | string[] | User-defined tags |
| transcription.status | enum | `none`, `pending`, `processing`, `complete`, `failed` |
| transcription.lastAttempt | ISO 8601 | When transcription was last attempted |
| transcription.error | string? | Error message if status is `failed` |

### strokes.json

```json
{
  "version": 1,
  "strokes": [
    {
      "id": "st_uuid",
      "timestamp": 1706436300000,
      "tool": "pen",
      "color": "#000000",
      "width": 2,
      "points": [
        [100.5, 200.3, 0.8, 1706436300000],
        [101.2, 201.1, 0.85, 1706436300005],
        [102.0, 202.5, 0.9, 1706436300010]
      ]
    }
  ]
}
```

**Point format:** `[x, y, pressure, timestamp]`

- x, y: Coordinates relative to page origin (top-left)
- pressure: 0.0 to 1.0, from stylus
- timestamp: Unix milliseconds, for replay/animation if needed

**Tool types:** `pen`, `highlighter`, `eraser`

### transcription.md

Plain markdown file containing the transcribed text. Kept separate from meta.json for easy access and editing.

When `markdown.frontmatter.enabled` is true, the file includes YAML frontmatter generated from the configured template:

```markdown
---
title: "Meeting notes - Project X kickoff"
date: 2025-01-28T10:05:00Z
modified: 2025-01-28T10:45:00Z
tags:
  - meeting
  - project-x
notebook: "Project Notes"
page_id: pg_x1y2z3
---
Meeting notes - Project X kickoff

Attendees: Alice, Bob, Charlie

Key decisions:
- Launch date set for March 15
- Budget approved at $50k
- Weekly syncs on Tuesdays

Action items:
- Alice to draft project plan
- Bob to set up dev environment
```

When frontmatter is disabled, the file contains only the raw transcription text (no frontmatter block).

---

## API Specification

Base URL: `http://{minipc-ip}:3000/api`

All endpoints return JSON unless otherwise specified. Errors return:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Page not found"
  }
}
```

### Notebooks

#### List notebooks

```
GET /notebooks
```

Query parameters:
- `sort`: `name`, `created`, `modified` (default: `modified`)
- `order`: `asc`, `desc` (default: `desc`)

Response:
```json
{
  "notebooks": [
    {
      "id": "nb_a1b2c3d4",
      "name": "Project Notes",
      "created": "2025-01-28T10:00:00Z",
      "modified": "2025-01-28T14:30:00Z",
      "pageCount": 12
    }
  ]
}
```

#### Create notebook

```
POST /notebooks
```

Request:
```json
{
  "name": "New Notebook"
}
```

Response: Full notebook object with generated ID.

#### Get notebook

```
GET /notebooks/:notebookId
```

Response:
```json
{
  "id": "nb_a1b2c3d4",
  "name": "Project Notes",
  "created": "2025-01-28T10:00:00Z",
  "modified": "2025-01-28T14:30:00Z",
  "settings": { ... },
  "pages": [
    {
      "id": "pg_x1y2z3",
      "seq": 1,
      "canvas": { "x": 0, "y": 0, "width": 1404, "height": 1872 },
      "modified": "2025-01-28T10:45:00Z",
      "transcription": { "status": "complete" },
      "thumbnailUrl": "/api/pages/pg_x1y2z3/thumbnail"
    }
  ]
}
```

#### Update notebook

```
PATCH /notebooks/:notebookId
```

Request:
```json
{
  "name": "Renamed Notebook",
  "settings": {
    "defaultTool": "highlighter"
  }
}
```

#### Delete notebook

```
DELETE /notebooks/:notebookId
```

Deletes notebook and all contained pages.

---

### Pages

#### Create page

```
POST /notebooks/:notebookId/pages
```

Request:
```json
{
  "canvas": {
    "x": 1500,
    "y": 0
  }
}
```

If `canvas.x` and `canvas.y` are omitted, the page is placed automatically (to the right of the rightmost existing page, or at origin if first page).

If `seq` is omitted, it's set to max(existing seq) + 1.

Response: Full page object.

#### Get page

```
GET /pages/:pageId
```

Response:
```json
{
  "id": "pg_x1y2z3",
  "notebookId": "nb_a1b2c3d4",
  "created": "2025-01-28T10:05:00Z",
  "modified": "2025-01-28T10:45:00Z",
  "canvas": { "x": 0, "y": 0, "width": 1404, "height": 1872 },
  "seq": 1,
  "links": [],
  "tags": [],
  "transcription": {
    "status": "complete",
    "content": "Meeting notes - Project X kickoff..."
  },
  "strokes": {
    "version": 1,
    "strokes": [ ... ]
  }
}
```

#### Update page

```
PATCH /pages/:pageId
```

Request (all fields optional):
```json
{
  "canvas": { "x": 100, "y": 200 },
  "seq": 5,
  "links": ["pg_abc123"],
  "tags": ["important"]
}
```

#### Delete page

```
DELETE /pages/:pageId
```

---

### Strokes

#### Append strokes

```
POST /pages/:pageId/strokes
```

Request:
```json
{
  "strokes": [
    {
      "id": "st_newstroke",
      "timestamp": 1706436300000,
      "tool": "pen",
      "color": "#000000",
      "width": 2,
      "points": [ ... ]
    }
  ]
}
```

Strokes are appended to the existing strokes array. This endpoint is called by the frontend to batch-save strokes periodically.

Response:
```json
{
  "strokeCount": 45,
  "modified": "2025-01-28T10:45:00Z"
}
```

#### Delete stroke

```
DELETE /pages/:pageId/strokes/:strokeId
```

Used for eraser functionality. Removes the stroke with the given ID.

#### Clear all strokes

```
DELETE /pages/:pageId/strokes
```

Removes all strokes from the page.

---

### Transcription

#### Trigger transcription

```
POST /pages/:pageId/transcribe
```

Request (optional):
```json
{
  "force": true
}
```

If `force` is true, re-transcribes even if already complete.

Response:
```json
{
  "status": "pending",
  "jobId": "job_abc123"
}
```

#### Get transcription

```
GET /pages/:pageId/transcription
```

Response:
```json
{
  "status": "complete",
  "content": "Meeting notes - Project X kickoff...",
  "lastAttempt": "2025-01-28T10:46:00Z"
}
```

#### Bulk transcribe

```
POST /notebooks/:notebookId/transcribe
```

Queues transcription for all pages in notebook that don't have status `complete`.

---

### Export

#### Export page as PDF

```
GET /pages/:pageId/export/pdf
```

Returns PDF file with `Content-Type: application/pdf`.

Query parameters:
- `includeTranscription`: `true`/`false` (default: `false`) - adds transcription text on second page

#### Export notebook as PDF

```
GET /notebooks/:notebookId/export/pdf
```

Returns PDF with all pages in sequential order.

Query parameters:
- `includeTranscription`: `true`/`false`
- `pageSize`: `original`, `a4`, `letter` (default: `original`)

#### Export page as PNG

```
GET /pages/:pageId/export/png
```

Query parameters:
- `scale`: number (default: `1`)

---

### Thumbnails

#### Get page thumbnail

```
GET /pages/:pageId/thumbnail
```

Returns PNG thumbnail. Generated on first request and cached. Cache invalidated when strokes are modified.

Query parameters:
- `width`: number (default: `200`)

---

### Search

#### Search transcriptions

```
GET /search
```

Query parameters:
- `q`: search query (required)
- `notebook`: notebook ID (optional, limits search to one notebook)
- `limit`: max results (default: `20`)

Response:
```json
{
  "results": [
    {
      "pageId": "pg_x1y2z3",
      "notebookId": "nb_a1b2c3d4",
      "notebookName": "Project Notes",
      "excerpt": "...Launch date set for March 15...",
      "modified": "2025-01-28T10:45:00Z",
      "thumbnailUrl": "/api/pages/pg_x1y2z3/thumbnail"
    }
  ],
  "total": 5
}
```

---

### Markdown Sync

#### Sync page markdown

```
POST /pages/:pageId/sync
```

Copies the page's transcription markdown (with frontmatter if enabled) to the configured sync destination. Returns 400 if `markdown.sync.enabled` is false or no destination is configured.

Response:
```json
{
  "synced": true,
  "destination": "/path/to/target/directory/Project Notes/1-pg_x1y2z3.md"
}
```

#### Sync notebook markdown

```
POST /notebooks/:notebookId/sync
```

Syncs all transcribed pages in the notebook to the configured destination.

Response:
```json
{
  "synced": 12,
  "skipped": 3,
  "destination": "/path/to/target/directory/Project Notes/"
}
```

#### Get sync status

```
GET /sync/status
```

Response:
```json
{
  "enabled": true,
  "destination": "/path/to/target/directory",
  "lastSync": "2025-01-28T15:00:00Z",
  "totalSynced": 45
}
```

#### Update markdown config

```
PATCH /config/markdown
```

Request:
```json
{
  "frontmatter": {
    "enabled": true,
    "template": {
      "title": "{{transcription.firstLine}}",
      "date": "{{page.created}}",
      "tags": "{{page.tags}}"
    }
  },
  "sync": {
    "enabled": true,
    "destination": "/home/user/obsidian-vault/inkwell"
  }
}
```

Response: Updated markdown config object.

---

### WebSocket Events

Connect to `ws://{minipc-ip}:3000/ws` for real-time updates.

#### Client → Server

**Subscribe to page**
```json
{
  "type": "subscribe",
  "pageId": "pg_x1y2z3"
}
```

**Unsubscribe from page**
```json
{
  "type": "unsubscribe",
  "pageId": "pg_x1y2z3"
}
```

#### Server → Client

**Transcription complete**
```json
{
  "type": "transcription.complete",
  "pageId": "pg_x1y2z3",
  "content": "Transcribed text..."
}
```

**Transcription failed**
```json
{
  "type": "transcription.failed",
  "pageId": "pg_x1y2z3",
  "error": "API rate limit exceeded"
}
```

**Markdown synced**
```json
{
  "type": "markdown.synced",
  "pageId": "pg_x1y2z3",
  "destination": "/path/to/target/directory/Project Notes/1-pg_x1y2z3.md"
}
```

**Markdown sync failed**
```json
{
  "type": "markdown.sync.failed",
  "pageId": "pg_x1y2z3",
  "error": "Destination directory does not exist"
}
```

---

## Frontend Specification

### Technology Stack

- **Framework**: React
- **Inking**: Perfect Freehand for stroke rendering
- **Canvas**: HTML Canvas with custom pan/zoom
- **State**: Zustand or similar lightweight store
- **Styling**: Tailwind CSS

### Views

#### 1. Notebook List View

The home screen. Shows all notebooks as cards with name, page count, last modified date, and a preview thumbnail of the most recent page.

Actions:
- Create new notebook
- Open notebook (goes to Canvas View)
- Delete notebook (with confirmation)
- Rename notebook (inline edit)

#### 2. Canvas View (Infinite Canvas)

The spatial view showing all pages arranged on a 2D canvas.

**Navigation:**
- Pan: Two-finger drag or click-and-drag on empty space
- Zoom: Pinch or scroll wheel
- Page tap: Opens page in Page View

**UI Elements:**
- Minimap in corner showing current viewport position
- Zoom controls (+/- buttons)
- "Fit all" button to zoom out to see all pages
- "Add page" button - creates new page at current viewport center
- Button to switch to Notebook View

**Page rendering:**
- At zoom levels < 50%: Show thumbnails only
- At zoom levels >= 50%: Render actual strokes
- Selected page has visible border

**Page manipulation:**
- Drag page to reposition on canvas
- Drag handle (grip icon) on each page for mouse-based repositioning (touch drag also supported)
- Context menu (long press): Delete, Duplicate, Transcribe, Export

#### 3. Notebook View (Sequential)

Linear view of pages in sequence order, like scrolling through a physical notebook.

**Layout:**
- Vertical stack of pages
- Current page centered, adjacent pages partially visible
- Swipe up/down to navigate

**UI Elements:**
- Page number indicator (e.g., "3 / 12")
- Button to switch to Canvas View
- Same context menu as Canvas View

#### 4. Page View (Editing)

Full-screen single page for writing.

**Drawing surface:**
- Receives pointer events from boox-rapid-draw passthrough
- Renders strokes using Perfect Freehand
- Page background (plain, lined, grid, dot grid - from notebook settings)

**Toolbar (minimal, e-ink friendly):**
- Tool selection: Pen, Highlighter, Eraser
- Stroke width: 3 presets (fine, medium, bold)
- Color: Black, Blue, Red (limited palette for e-ink)
- Undo/Redo
- Close (return to previous view)

**Gestures:**
- Two-finger tap: Undo
- Three-finger tap: Redo
- Swipe from edge: Close page

**Auto-save:**
- Strokes batched and sent to server every 2 seconds during active drawing
- Immediate save on page close

**Transcription:**
- If auto-transcribe enabled: Triggers 5 seconds after last stroke
- Status indicator shows transcription state
- Tap indicator to view/edit transcription

#### 5. Search View

Full-text search across all transcriptions.

**UI:**
- Search input at top
- Results as cards showing excerpt, notebook name, thumbnail
- Tap result to open page

---

## Transcription Pipeline

### Flow

1. **Trigger**: Auto (after stroke idle timeout) or manual (user request)
2. **Queue**: Job added to transcription queue with page ID
3. **Process**: 
   - Render strokes to PNG
   - Send to Gemini 3 API with prompt for handwriting recognition
   - Parse response
4. **Save**: Write transcription.md file
5. **Notify**: WebSocket event to connected clients

### Gemini 3 API Integration

**Model**: `gemini-3-flash-preview`

Gemini 3 Flash is ideal for this use case - it offers Pro-level intelligence at Flash-level latency and cost. It has a free tier in the Gemini API, making it cost-effective for frequent transcription jobs.

| Model | Context Window | Pricing (per 1M tokens) |
|-------|----------------|-------------------------|
| gemini-3-flash-preview | 1M in / 64k out | $0.50 input / $3 output |
| gemini-3-pro-preview | 1M in / 64k out | $2 input / $12 output |

**Configuration**:

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function transcribePage(imageBase64: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { 
            text: `Transcribe the handwritten text in this image.

Rules:
- Preserve the original structure (paragraphs, lists, etc.)
- Use markdown formatting where appropriate
- If text is unclear, make your best guess and mark uncertain words with [?]
- Do not add any commentary or explanation, only the transcribed text`
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: imageBase64
            },
            mediaResolution: {
              level: "media_resolution_high"  // 1120 tokens - best for OCR
            }
          }
        ]
      }
    ],
    config: {
      thinkingConfig: {
        thinkingLevel: "low"  // Transcription doesn't need deep reasoning
      }
    }
  });

  return response.text;
}
```

**Key Gemini 3 considerations**:

1. **Media resolution**: Use `media_resolution_high` (1120 tokens per image) for best OCR quality on handwriting. This is the recommended setting for image analysis tasks.

2. **Thinking level**: Set to `low` for transcription - it's a straightforward task that doesn't benefit from extended reasoning. This minimises latency and cost.

3. **Temperature**: Leave at default (1.0). Gemini 3 is optimised for this setting; lowering it can cause looping or degraded performance.

4. **No thought signatures needed**: Since we're doing single-turn requests (one image → one transcription), we don't need to handle thought signature circulation. Signatures are only critical for multi-turn conversations and function calling.

**Error handling**:
- Rate limit: Exponential backoff, max 3 retries
- API error: Mark status as `failed`, store error message
- Empty response: Mark as complete with empty content
- 400 errors: Check for malformed requests or missing required fields

**Rate limits** (free tier):
- 10 RPM (requests per minute)
- 250,000 TPM (tokens per minute)
- 500 RPD (requests per day)

For heavy usage, consider the pay-as-you-go tier which has significantly higher limits.

### Queue Implementation

Simple file-based queue or in-memory with persistence:

```
/data/inkwell/queue/
  pending/
    {timestamp}_{pageId}.json
  processing/
    {timestamp}_{pageId}.json
  failed/
    {timestamp}_{pageId}.json
```

Worker process checks pending directory, moves to processing, calls API, moves to failed or deletes on success.

**Job file format**:
```json
{
  "pageId": "pg_x1y2z3",
  "notebookId": "nb_a1b2c3d4",
  "createdAt": "2025-01-28T10:50:00Z",
  "attempts": 0,
  "lastError": null
}
```

**Worker logic**:
```javascript
async function processTranscriptionQueue() {
  const pendingJobs = await fs.readdir('/data/inkwell/queue/pending');
  
  for (const jobFile of pendingJobs) {
    const job = JSON.parse(await fs.readFile(`pending/${jobFile}`));
    
    // Move to processing
    await fs.rename(`pending/${jobFile}`, `processing/${jobFile}`);
    
    try {
      // Render page to PNG
      const imageBase64 = await renderPageToPng(job.pageId);
      
      // Call Gemini 3
      const transcription = await transcribePage(imageBase64);
      
      // Save transcription
      await fs.writeFile(
        `/data/inkwell/notebooks/${job.notebookId}/pages/${job.pageId}/transcription.md`,
        transcription
      );
      
      // Update page meta
      await updatePageMeta(job.pageId, {
        transcription: { status: 'complete', lastAttempt: new Date().toISOString() }
      });
      
      // Remove job file
      await fs.unlink(`processing/${jobFile}`);
      
      // Notify clients via WebSocket
      broadcast({ type: 'transcription.complete', pageId: job.pageId, content: transcription });
      
    } catch (error) {
      job.attempts++;
      job.lastError = error.message;
      
      if (job.attempts >= 3) {
        // Move to failed
        await fs.rename(`processing/${jobFile}`, `failed/${jobFile}`);
        await updatePageMeta(job.pageId, {
          transcription: { status: 'failed', lastAttempt: new Date().toISOString(), error: error.message }
        });
        broadcast({ type: 'transcription.failed', pageId: job.pageId, error: error.message });
      } else {
        // Retry with backoff
        const backoffMs = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => {
          fs.rename(`processing/${jobFile}`, `pending/${jobFile}`);
        }, backoffMs);
      }
    }
  }
}

// Run every 5 seconds
setInterval(processTranscriptionQueue, 5000);
```

---

## PDF Export

### Implementation

Use `pdfkit` for vector PDF generation.

**Process:**
1. Create PDF document with page size matching original
2. For each stroke:
   - Run points through Perfect Freehand to get outline
   - Convert outline to PDF path commands
   - Fill path with stroke color (handles pressure variation)
3. If `includeTranscription`: Add new page with transcription text

**Stroke to path conversion:**
```javascript
const outlinePoints = getStroke(stroke.points, {
  size: stroke.width,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
});

// Convert to SVG path string, then to PDF path
const pathData = getSvgPathFromStroke(outlinePoints);
doc.path(pathData).fill(stroke.color);
```

---

## Implementation Phases

### Phase 1: Core Writing

- [x] Project setup (React + Express)
- [x] File system storage layer
- [x] Basic API (notebooks, pages, strokes)
- [x] Single page writing view
- [x] Stroke capture and persistence
- [x] Perfect Freehand rendering

**Milestone**: Can create notebook, create page, write on page, close and reopen with strokes preserved.

### Phase 2: Navigation

- [x] Notebook list view
- [x] Canvas view with pan/zoom
- [x] Page positioning and dragging
- [x] Notebook view (sequential)
- [x] Thumbnail generation

**Milestone**: Can navigate between pages in both views, rearrange pages on canvas.

### Phase 3: Transcription

- [x] Gemini API integration
- [x] Transcription queue and worker
- [x] Auto-transcribe on idle
- [x] Transcription status UI
- [x] View/edit transcription

**Milestone**: Pages automatically transcribed, can search transcriptions.

### Phase 4: Export & Polish

Backend:
- [x] PDF export (single page and notebook)
- [x] PNG export
- [x] Search functionality
- [x] Page linking
- [x] Tags
- [x] Settings (notebook settings API)

Frontend:
- [ ] Export UI (buttons/dialogs for PDF and PNG export)
- [ ] Search view (search input, result cards with excerpt/thumbnail)
- [ ] Page linking UI (view/edit links on pages)
- [ ] Tags UI (view/add/remove tags on pages)
- [ ] Settings UI (defaultTool, defaultColor, defaultStrokeWidth — grid type already in toolbar)

**Milestone**: Feature complete — all features accessible from the UI.

### Phase 5: Refinement

- [x] Offline support (service worker)
- [x] Undo/redo with history
- [x] Multiple pen/color presets
- [x] Background templates (lined, grid, etc.)
- [x] Performance optimization for large notebooks
- [x] Pinch-to-zoom for single page, scroll, and canvas views
- [x] Two-finger double-tap to reset zoom
- [x] Conditional touch-action (touch-pan-y in scroll mode, touch-none elsewhere)
- [ ] Drag handle on canvas view pages (mouse-friendly page repositioning)

### Phase 6: Markdown & Sync

- [x] Configurable YAML frontmatter for transcription markdown files
- [x] Template variable system for frontmatter values
- [x] Frontmatter regeneration when page tags or metadata change
- [x] Configurable sync destination path on server
- [x] Filename template for synced files (supports subdirectories)
- [x] Auto-sync on transcription completion
- [x] Manual sync API (per-page and per-notebook)
- [x] Sync status tracking and API
- [x] Markdown config API (PATCH /api/config/markdown)
- [ ] Markdown config UI in settings
- [ ] Tag management UI on page view (add/remove tags)

**Milestone**: Transcription markdown files include configurable frontmatter and are automatically synced to an external directory (e.g., an Obsidian vault).

---


