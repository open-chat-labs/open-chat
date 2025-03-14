use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(group, block_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub correlation_id: u64,
}

#[ts_export(group, block_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    CannotBlockSelf,
    CannotBlockUser,
    GroupNotPublic,
    InternalError(String),
    NotAuthorized,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
    Error(u16, Option<String>),
}

impl From<crate::remove_participant::Response> for Response {
    fn from(response: crate::remove_participant::Response) -> Self {
        match response {
            crate::remove_participant::Response::Success => Response::Success,
            crate::remove_participant::Response::Error(code, message) => Response::Error(code, message),
            crate::remove_participant::Response::CallerNotInGroup => Response::CallerNotInGroup,
            crate::remove_participant::Response::CannotRemoveSelf => Response::CannotBlockSelf,
            crate::remove_participant::Response::CannotRemoveUser => Response::CannotBlockUser,
            crate::remove_participant::Response::InternalError(e) => Response::InternalError(e),
            crate::remove_participant::Response::NotAuthorized => Response::NotAuthorized,
            crate::remove_participant::Response::UserNotInGroup => Response::UserNotInGroup,
            crate::remove_participant::Response::UserSuspended => Response::UserSuspended,
            crate::remove_participant::Response::UserLapsed => Response::UserLapsed,
            crate::remove_participant::Response::ChatFrozen => Response::ChatFrozen,
        }
    }
}
