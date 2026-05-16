# Daily View Schedule Design

## Goal

The main Notes view becomes the user's Today view: a live view of the sticky notes that are relevant for the current day. Notes can remain stored in notes, archive, calendar, or projects, but Today decides what to show based on date and schedule rules.

The calendar remains the tracking/history surface. A note appearing in Today is planning, not tracking. Calendar entries are created or updated only when the user explicitly records work.

## Core Model

Today is a computed view, not a physical folder. Each visible item keeps a source reference so completion can update the correct underlying data without duplication.

Sources:

- `active`: a normal active note already in the Notes data.
- `archived-repeat`: an archived note whose Repeat rule applies today.
- `calendar-instance`: a calendar entry scheduled for today.
- `project`: a project item when used directly with the timer.

The UI can present these as normal sticky notes, but actions must preserve their source.

## Repeat Behavior

The existing Repeat setting becomes authoritative for Today visibility.

Supported rules:

- `every 1 day`: appears every day.
- `every 2 days`: appears every two days based on the schedule start date.
- `every N weeks` plus weekdays: appears on the selected weekdays in matching weeks.
- `every N months` and `every N years`: appears according to the schedule date/time rule.
- `in N units`: appears once at the target date/time.
- calendar-created future notes: appear in Today on their calendar date.

If a recurring archived note appears today and the user does nothing, it naturally disappears from Today when the day changes. It remains archived and will reappear on its next valid occurrence.

If the user manually archives/rearchives a Today item that came from archive, no duplicate archive entry is created. The app should mark or remember that this occurrence was dismissed for the current day, while leaving the original archived note intact.

## Calendar Tracking

A note is recorded in the calendar only through explicit tracking:

- a completed pomodoro;
- a completed stopwatch;
- long press on the existing print-to-calendar action.

Today visibility alone never creates a calendar entry.

Completion rules:

- `active`: create a new calendar entry and archive the original note after completion.
- `archived-repeat`: create a new calendar entry, keep the original archived note, and dismiss today's occurrence.
- `calendar-instance`: update or replace the existing calendar entry instead of creating a duplicate.
- manual print follows the same source-aware rules.

When a calendar instance is updated after timer completion, it should preserve the calendar date context and replace the previous scheduled entry for that occurrence with the completed/tracked entry.

## Archive Behavior

Archive stores inactive or recurring notes. It is not a duplicate sink.

Rearchiving a Today item:

- Active note: move it to archive once.
- Archived recurring note visible in Today: dismiss today's occurrence only; do not add another archived copy.
- Calendar instance: remove it from Today only if that action is intended as a daily dismissal; do not duplicate it into archive unless the user explicitly sends it there through an unarchive/archive workflow.

Archived notes keep all metadata: repeat, reminder, project assignment, timer preferences, color, body, and title.

## Day Rollover

The app recalculates Today:

- on app startup;
- when returning to the Notes view;
- when the device date crosses midnight while the app is open;
- after changes to schedule, archive, calendar, or note data.

This recalculation should be idempotent. Running it multiple times must not create duplicates or mutate data unnecessarily.

## Projects

Projects remain an organizational overlay. A note can appear in Today because of its schedule while still belonging to a project.

Project membership should survive archive/calendar movement unless the app is creating a separate tracking copy in the calendar. Timer-printed copies should not inherit `projectId` unless the user explicitly assigns the calendar entry to a project.

## Reminders

Reminders remain tied to schedule/calendar timing, not Today visibility. If a note is archived but scheduled for a reminder, the reminder should remain active.

For calendar instances, reminder timing comes from the calendar entry date/time.

## Testing Focus

Tests should cover:

- recurring archived note appears today without duplication;
- rearchiving a recurring Today item does not duplicate archive data;
- calendar-created note appears on its date;
- completing a calendar-origin note updates the existing calendar entry instead of duplicating it;
- active note completion creates a new calendar entry and archives the note;
- day rollover recalculates Today without mutations or duplicates;
- `every 2 days`, weekly weekdays, and one-time `in N days` behave correctly.

