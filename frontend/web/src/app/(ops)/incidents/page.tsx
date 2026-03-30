import { redirect } from 'next/navigation';

// /incidents has no standalone page — the dashboard IS the incident queue.
// Redirect so bookmarks and stale links land somewhere useful.
export default function IncidentsIndexPage() {
  redirect('/dashboard');
}
