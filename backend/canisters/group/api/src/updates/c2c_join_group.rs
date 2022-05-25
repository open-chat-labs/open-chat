use crate::c2c_join_group_v2::Response as ResponseV2;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::MessageIndex;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    pub as_super_admin: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyInGroup,
    GroupNotPublic,
    Blocked,
    ParticipantLimitReached(u32),
    NotSuperAdmin,
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub latest_message_index: Option<MessageIndex>,
}

impl From<ResponseV2> for Response {
    fn from(response: ResponseV2) -> Self {
        match response {
            ResponseV2::Success(s) => Response::Success(SuccessResult {
                latest_message_index: s.latest_message.map(|m| m.event.message_index),
            }),
            ResponseV2::AlreadyInGroup => Response::AlreadyInGroup,
            ResponseV2::GroupNotPublic => Response::GroupNotPublic,
            ResponseV2::Blocked => Response::Blocked,
            ResponseV2::ParticipantLimitReached(l) => Response::ParticipantLimitReached(l),
            ResponseV2::NotSuperAdmin => Response::NotSuperAdmin,
            ResponseV2::InternalError(e) => Response::InternalError(e),
        }
    }
}
