export type TableColumn = { id: string; label: string };
export const readTable = (answer: string): Record<string, string>[] => {
  if (!answer) return [];
  try { const rows = JSON.parse(answer); if (!Array.isArray(rows)) throw new Error(); return rows; } catch { throw new Error("Invalid table answer"); }
};
export function validateTable(answer: string, columns: TableColumn[], complete = false, required = false) {
  const rows = readTable(answer);
  if (rows.length > 20 || complete && required && !rows.length) throw new Error("Complete the table");
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => !columns.some(c => c.id === key))) throw new Error("Invalid table row");
    for (const column of columns) {
      const value = row[column.id] ?? "";
      if (typeof value !== "string" || value.length > 2000 || complete && columns[0].id === column.id && !value.trim()) throw new Error("Complete the first cell of each row");
    }
  }
  return rows;
}

// Carry each planned objective into the review without overwriting evidence
// already entered. This stays within one document, never another child's data.
export function addObjectivesToReview(objectives: string, review: string): string {
  const rows = readTable(review).map(row => ({ ...row }));
  const seen = new Set(rows.map(row => row.column_1?.trim()).filter(Boolean));
  for (const row of readTable(objectives)) {
    const objective = row.column_1?.trim();
    if (objective && !seen.has(objective) && rows.length < 20) { rows.push({ column_1: objective }); seen.add(objective); }
  }
  return JSON.stringify(rows);
}

// Explicit import: keep each original line as an objective, never invent a
// target, score, responsible person or frequency from free text.
export function importProfileObjectives(outcomes: string, support: string, current: string): string {
  const rows = readTable(current).map(row => ({ ...row }));
  const goals = [...new Set(outcomes.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  if (support.length > 2000 || goals.some(goal => goal.length > 2000)) throw new Error("Profile text exceeds table cell limit");
  for (const goal of goals) {
    if (rows.some(row => row.column_1?.trim() === goal)) continue;
    const empty = rows.find(row => Object.values(row).every(value => !value.trim()));
    if (!empty && rows.length >= 20) throw new Error("Table row limit reached");
    const row = empty ?? {};
    row.column_1 = goal; row.column_4 = support.trim();
    if (!empty) rows.push(row);
  }
  return JSON.stringify(rows);
}
