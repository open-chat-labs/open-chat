use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, GameConfig, GameId};

pub type Args = Empty;

#[ts_export(daily_puzzle, game_configs)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<(GameId, GameConfig)>),
    Error(OCError),
}
