use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Deliberately triggers the one-off removal of all legacy DecideAI unique
// person proofs (the cutover wipe). Governance-controlled so the rollout
// decides exactly when badges disappear, rather than it firing on upgrade.
#[ts_export(user_index, wipe_legacy_unique_person_proofs)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {}

pub type Response = UnitResult;
