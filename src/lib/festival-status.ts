// Where a festival edition stands on a given day. Shared by the build and the browser:
// the static page states the build day's answer, and a small script re-asks it on the reader's
// day so a deadline that has passed since the last deploy never reads as open.

export type Milestone = { kind: string; date: string; endDate?: string };
export type Phase = 'open' | 'closing' | 'voting' | 'live' | 'upcoming' | 'pending' | 'results';
export const PHASE_LABEL: Record<Phase, string> = {
  open: 'Entries open',
  closing: 'Closing soon',
  voting: 'Public voting',
  live: 'Happening now',
  upcoming: 'Upcoming',
  pending: 'Results pending',
  results: 'Results',
};
/** Index sections, in page order. */
export const PHASE_GROUP: Record<Phase, 'open' | 'soon' | 'results'> = {
  open: 'open',
  closing: 'open',
  voting: 'soon',
  live: 'soon',
  upcoming: 'soon',
  pending: 'soon',
  results: 'results',
};

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
export const today = () => new Date().toISOString().slice(0, 10);

/** The next dated milestone still to come (or still running) on that day. */
export const nextMilestone = (milestones: Milestone[], day: string) => milestones.find((m) => (m.endDate ?? m.date) >= day);

/** hasResults: the organiser has published decisive results for this edition. */
export function phaseOf(milestones: Milestone[], hasResults: boolean, day: string): Phase {
  if (hasResults) return 'results';
  const opens = milestones.find((m) => m.kind === 'Entries open');
  const deadline = milestones.filter((m) => /deadline/i.test(m.kind)).at(-1);
  if (deadline && day <= deadline.date && (!opens || opens.date <= day)) return days(day, deadline.date) <= 14 ? 'closing' : 'open';
  // A call that is open but has not dated its deadline yet.
  if (!deadline && opens && opens.date <= day && milestones.every((m) => m === opens || m.date > day)) return 'open';
  const voteOpens = milestones.find((m) => m.kind === 'Voting opens');
  const voteCloses = milestones.find((m) => m.kind === 'Voting closes');
  if (voteOpens && voteCloses && voteOpens.date <= day && day <= voteCloses.date) return 'voting';
  if (milestones.some((m) => (m.kind === 'Screening' || m.kind === 'Ceremony') && m.date <= day && day <= (m.endDate ?? m.date))) return 'live';
  return nextMilestone(milestones, day) ? 'upcoming' : 'pending';
}

const fmt = (d: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
export const dateRange = (m: Milestone) => (m.endDate && m.endDate !== m.date ? `${fmt(m.date)} – ${fmt(m.endDate)}` : fmt(m.date));
/** "Deadline · 15 Nov 2026": what a card says comes next. */
export function nextLine(milestones: Milestone[], day: string) {
  const next = nextMilestone(milestones, day);
  return next ? `${next.kind} · ${dateRange(next)}` : undefined;
}
/** A card's second line: what comes next, or why nothing is dated. */
export function statusLine(milestones: Milestone[], phase: Phase, day: string) {
  return nextLine(milestones, day) ?? (phase === 'open' ? 'Deadline not yet announced' : 'Results not yet published');
}
/** How cards sort within their section: soonest first while open or coming up, newest results first. */
export function sortKeyOf(milestones: Milestone[], phase: Phase, day: string) {
  if (phase === 'results') return milestones.findLast((m) => m.kind === 'Results')?.date ?? milestones.at(-1)!.date;
  return (nextMilestone(milestones, day) ?? milestones.at(-1)!).date;
}
