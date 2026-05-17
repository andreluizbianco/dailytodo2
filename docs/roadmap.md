# DailyTodo Roadmap

## Done

- Android notification controls synced with the app for Pomodoro and Stopwatch.
- Persistent Android timer notification with play/pause/stop actions.
- Native timer alert sound, vibration, and alarm volume setting with preview.
- Settings view opened from long press on the `+` button.
- Stronger global long-press haptic feedback.
- Per-note persistence for selected note, Pomodoro duration, and timer mode.
- Native Android Pomodoro wheel with snap, fade, haptic feedback, and per-note persistence.

## Next Priority

1. Archive reading flow.
   Improve archive so selecting an archived note shows its content immediately below or beside the archive list:
   - allow archived notes to be consulted without unarchiving them;
   - preserve the current unarchive flow as an explicit long-press/action;
   - keep search results and archived-note selection consistent.

2. Daily note scheduling foundation.
   Explore whether notes view should reorganize automatically each day, with the active day switching at midnight:
   - support notes that appear every day;
   - support notes assigned to specific weekdays, e.g. M T W T F S S toggles in note settings;
   - keep ordinary notes behavior clear so unscheduled notes do not disappear unexpectedly;
   - define how missed/incomplete scheduled notes should behave on the next day.
   - notes that are not active for the current day should remain accessible outside the daily Notes view, likely through Archive-style browsing rather than being hidden.

3. Calendar-created notes appearing in Notes view.
   For notes created from the calendar on a specific date/time:
   - show them in the main Notes view on their scheduled day;
   - keep editable calendar time as the source for date-specific placement;
   - avoid duplicating the same note between calendar storage and notes storage.

4. Reminders foundation.
   Add a clean reminder model per note before building the full UI:
   - reminder date/time per note;
   - optional repeat metadata;
   - relative reminder offset, such as minutes/hours/days/weeks before the target time;
   - stable reminder ids;
   - storage/export/import compatibility;
   - native scheduled notification path on Android.

5. Timer completion cleanup flow.
   Explore auto-archiving notes when timer work is completed:
   - when a Pomodoro finishes, print the note/session to Calendar and optionally archive the note automatically;
   - when a Stopwatch is stopped/completed, print the note/session to Calendar and optionally archive the note automatically;
   - this should help clear the daily Notes view through the day, like removing finished sticky notes from a wall;
   - add a per-note or global setting for how many completed timer sessions are required before auto-archive;
   - avoid duplicate calendar entries when multiple sessions happen before archive;
   - preserve note identity and history after archive.

6. Reminder UI.
   Add controls inside note settings or a dedicated note reminder area:
   - create/edit/remove reminder;
   - `remind me` switch in note settings;
   - compact wheel-style controls for reminder amount and unit, e.g. minutes/hours/days/weeks;
   - show upcoming reminder state on the note;
   - snooze/repeat actions later.

## Brainstorm Notes

- The note settings menu should likely grow to include scheduling controls alongside color/delete/archive:
  - `everyday` switch for notes that should always appear;
  - weekday toggles for recurring weekly appearance;
  - `remind me` switch for notification reminders.
- Midnight rollover needs a careful design before implementation:
  - what happens if the app is closed at midnight;
  - whether native/background logic or app startup should reconcile the active day;
  - how to avoid surprising the user by hiding unfinished work.
- Calendar, recurring weekdays, and reminders should share one scheduling model rather than three separate ad hoc systems.
- A note should have one clear current place:
  - active in the daily Notes view for today;
  - accessible through Archive-style browsing when it is not scheduled for today;
  - visible in Calendar when it was created or placed on a specific future date.
- Scheduled notes should feel like they are dynamically archived/unarchived by date, without losing their identity or creating duplicates.
- Timer completion can become part of the daily progress model:
  - completed timer sessions print to Calendar;
  - after a configurable number of sessions, the note can auto-archive out of today's Notes view;
  - this gives the app the feeling of clearing physical sticky notes after finishing tasks.

## Backlog

### Calendar Polish

- Improve Pomodoro/manual-time badges.
- Avoid duplicates definitively with `sessionId`.
- Improve visual editing for time/duration.

### Backup, Export, Import

- Private JSON backup.
- Safe import without duplicating data.
- Consider an "export all data" option.

### Haptics

- Audit edit/delete/archive actions for consistent tactile feedback.
- Standardize haptic intensity by action type.

### Timer And Wheel Polish

- Continue small feel/visual refinements after real use.
- Consider configurable max Pomodoro duration if needed.
- Keep React state as the source of persisted note values; keep the native wheel visual-only.

### Google Calendar

- Optional future integration through Google OAuth.
- Export completed Pomodoro/manual calendar entries to the user's Google Calendar.
- Keep local calendar storage independent so the app works without Google login.
