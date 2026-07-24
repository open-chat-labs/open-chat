use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{UnitResult, UserId};

// Designates the vault reviewers: the (two-authority grant model) intersection of DAO-appointed
// platform moderators and OpenChat Labs' designated, trained personnel. Grantable only by a
// platform operator; every listed user must be a current platform moderator.
#[ts_export(user_index, set_vault_reviewers)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

pub type Response = UnitResult;
