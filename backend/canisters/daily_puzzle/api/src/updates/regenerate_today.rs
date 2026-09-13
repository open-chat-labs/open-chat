use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{GameId, UnitResult};

/// Ops tool: drops today's puzzle and regenerates it. `game_id` forces a game for today without
/// editing the schedule. See the impl for the caveats around user records already held by the
/// local user indexes.
#[ts_export(daily_puzzle, regenerate_today)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub game_id: Option<GameId>,
}

pub type Response = UnitResult;
