# Projects Design

## Goal

Add Projects as a lightweight way to group notes without changing the core sticky-note workflow. Projects should feel like a second layer of the existing Notes view, accessible quickly and visually distinct from regular notes.

## Access

Projects view opens from a long press on the docs icon in the top bar. A normal press on the docs icon keeps its current behavior for Notes/settings.

When Projects view is active, the left column remains visible. The stickies in that column represent projects instead of normal notes.

## Left Column Behavior

Project stickies use the same general sticky shape and color language as notes, but selected projects use a bottom selection bar instead of the normal left selection bar.

Selecting a project expands it inline. Notes belonging to that project appear directly below the project, indented only by the width of the normal note selection bar to preserve mobile space. Child notes keep the normal left selection bar.

If the selected project sticky is tapped again, it collapses and deselects. The left column returns to having no selected project or note.

Projects view shows only projects. Notes without a project stay in the normal Notes view and do not appear in a "No project" group.

## Right Column Behavior

When a project sticky is selected, the right column shows a project note/comment area. This behaves like an editable note for project-level context, planning, or comments.

When a child note inside a project is selected, the right column shows that note normally, using the existing note editor behavior.

When no project or note is selected in Projects view, the right column can remain empty or show the existing blank state.

## Creating Items

In Projects view:

- Long press on the `+` button creates a new project when no project is selected.
- Long press on the `+` button creates a new note inside the selected project when a project is selected.

In normal Notes view, the `+` behavior remains unchanged.

## Assigning Notes To Projects

Each note can belong to at most one project.

`TodoSettings` gets a collapsible `Project` section. It has no switch. Expanding it shows available projects as compact selectable chips/buttons matching the mockup direction.

Only one project can be selected at a time. Selecting a different project moves the note to that project. Tapping the already-selected project deselects it, leaving the note without a project.

Newly created projects should appear automatically in this settings section wherever note settings are rendered.

## Data Model

Add a `Project` model with:

- `id`
- `title`
- `note`
- `color`
- `createdAt`
- `isEditing`

Add `projectId?: number` to `Todo`.

Persist projects alongside todos in the existing stored data object. Existing data without projects migrates to `projects: []`, and existing notes have no `projectId`.

## Scope For First Implementation

Implement the functional foundation:

- project storage and persistence;
- Projects view access from long press on docs icon;
- project list rendering in the left column;
- project selection, expansion, collapse, and project note editing;
- child note rendering under selected project;
- create project or note-in-project from long press on `+`;
- project assignment in `TodoSettings`.

Leave richer project controls, archive behavior for projects, project search, and project cards in normal Notes view for later.
