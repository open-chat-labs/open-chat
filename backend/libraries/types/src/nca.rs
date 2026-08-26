use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

// The NCA CSEA-IRP priority level, assessed by the moderator at filing time (never derived by
// automation: the NCA expects a human judgement, and binding the choice into the signed token
// means a compromised filing service cannot downgrade it)
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum NcaPriority {
    // Current or immediate risk to an individual
    P1,
    // Possible risk to an individual in the near future or time-sensitive
    P2,
    // Other (including known hash-list matches with no impending danger)
    P3,
}
