use serde::{Deserialize, Serialize};
use types::UserId;
use types::c2c_can_issue_access_token::AccessTypeArgs;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub args: AccessTypeArgs,
}

pub type Response = types::c2c_can_issue_access_token::Response;
