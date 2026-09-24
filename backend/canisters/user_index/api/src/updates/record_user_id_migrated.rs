use serde::{Deserialize, Serialize};
use types::{ChatId, UnitResult, UserId};

// Only available in test mode, until the UserIndex migrates users itself
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub old_user_id: UserId,
    pub new_user_id: UserId,
    pub groups: Vec<ChatId>,
}

pub type Response = UnitResult;
