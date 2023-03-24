use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub correlation_id: u64,
}

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
    ChatFrozen,
}

impl From<crate::remove_participant::Response> for Response {
    fn from(response: crate::remove_participant::Response) -> Self {
        match response {
            crate::remove_participant::Response::Success => Response::Success,
            crate::remove_participant::Response::CallerNotInGroup => Response::CallerNotInGroup,
            crate::remove_participant::Response::CannotRemoveSelf => Response::CannotBlockSelf,
            crate::remove_participant::Response::CannotRemoveUser => Response::CannotBlockUser,
            crate::remove_participant::Response::InternalError(e) => Response::InternalError(e),
            crate::remove_participant::Response::NotAuthorized => Response::NotAuthorized,
            crate::remove_participant::Response::UserNotInGroup => Response::UserNotInGroup,
            crate::remove_participant::Response::UserSuspended => Response::UserSuspended,
            crate::remove_participant::Response::ChatFrozen => Response::ChatFrozen,
        }
    }
}
