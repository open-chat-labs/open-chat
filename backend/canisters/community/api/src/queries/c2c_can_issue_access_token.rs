use serde::{Deserialize, Serialize};
use types::{c2c_can_issue_access_token, ChannelId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub access_type: c2c_can_issue_access_token::AccessTypeArgs,
}

pub type Response = c2c_can_issue_access_token::Response;
