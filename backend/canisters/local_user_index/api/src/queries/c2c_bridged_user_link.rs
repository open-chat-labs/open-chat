use serde::{Deserialize, Serialize};
use types::{BridgedUserId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user: BridgedUserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    // The OpenChat user who has linked the account, if anyone has
    Success(Option<UserId>),
    // No one can link the account, eg. as it's a Discord bot or webhook, or a Telegram chat
    CantBeLinked,
}
