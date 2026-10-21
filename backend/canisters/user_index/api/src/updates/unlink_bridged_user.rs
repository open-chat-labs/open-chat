use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BridgedUserId, UnitResult};

// Unlinks an account on another platform from the OpenChat user it's linked to. Either that user
// can call this, or the platform's bridge bot when the account's owner asks there, since the bot
// vouches for the account as it does for the messages it relays. It succeeds, changing nothing,
// when the account isn't linked to the user calling.
#[ts_export(user_index, unlink_bridged_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user: BridgedUserId,
}

pub type Response = UnitResult;
