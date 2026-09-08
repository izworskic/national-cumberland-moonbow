import type { DriveCommitment } from "@/lib/types";

const options: Array<[DriveCommitment, string]> = [["local", "Local"], ["30m", "30 minutes"], ["1h", "1 hour"], ["2h", "2 hours"], ["3h", "3+ hours"]];

export function DecisionControls({ date, drive }: { date: string; drive: DriveCommitment }) {
  return <form className="decision-controls" method="get" aria-label="Change target date and trip commitment">
    <label><span>Target night</span><input type="date" name="date" defaultValue={date} min="2025-01-01" max="2031-12-31" /></label>
    <label><span>Should I drive?</span><select name="drive" defaultValue={drive}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <button type="submit">Update</button>
  </form>;
}
