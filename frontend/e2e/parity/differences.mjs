// OpenChat members the old UI trees call and the new ones deliberately don't (#10554, PRD #10550
// invariant 1). Each entry says why, and who decided. A textual false match is acknowledged as
// "not a gap: ..." so the reach report stays exact.
//
//   memberName: { reason: "...", decided: "who, YYYY-MM-DD" },

/** @type {Record<string, { reason: string; decided: string }>} */
export const differences = {};
