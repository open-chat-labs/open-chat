use crate::c2c_join_group;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::GroupCanisterGroupChatSummary;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub as_super_admin: bool,
    pub invite_code: Option<u64>,
    pub correlation_id: u64,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(GroupCanisterGroupChatSummary),
    AlreadyInGroup,
    GroupNotPublic,
    Blocked,
    ParticipantLimitReached(u32),
    NotSuperAdmin,
    UserNotFound,
    ChatFrozen,
    InternalError(String),
}

impl From<c2c_join_group::Response> for Response {
    fn from(value: c2c_join_group::Response) -> Self {
        match value {
            c2c_join_group::Response::Success(s) => Response::Success(*s),
            c2c_join_group::Response::AlreadyInGroup => Response::AlreadyInGroup,
            c2c_join_group::Response::GroupNotPublic => Response::GroupNotPublic,
            c2c_join_group::Response::Blocked => Response::Blocked,
            c2c_join_group::Response::ParticipantLimitReached(l) => Response::ParticipantLimitReached(l),
            c2c_join_group::Response::ChatFrozen => Response::ChatFrozen,
        }
    }
}
