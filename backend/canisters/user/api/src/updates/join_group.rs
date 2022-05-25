use crate::join_group_v2::Response as ResponseV2;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ChatId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub as_super_admin: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyInGroup,
    GroupNotFound,
    GroupNotPublic,
    ParticipantLimitReached(u32),
    Blocked,
    InternalError(String),
    NotSuperAdmin,
}

impl From<ResponseV2> for Response {
    fn from(response: ResponseV2) -> Self {
        match response {
            ResponseV2::Success(_) => Response::Success,
            ResponseV2::AlreadyInGroup => Response::AlreadyInGroup,
            ResponseV2::GroupNotFound => Response::GroupNotFound,
            ResponseV2::GroupNotPublic => Response::GroupNotPublic,
            ResponseV2::ParticipantLimitReached(l) => Response::ParticipantLimitReached(l),
            ResponseV2::Blocked => Response::Blocked,
            ResponseV2::InternalError(e) => Response::InternalError(e),
            ResponseV2::NotSuperAdmin => Response::NotSuperAdmin,
        }
    }
}
