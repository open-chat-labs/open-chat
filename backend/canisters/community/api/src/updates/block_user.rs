use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(community, block_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[ts_export(community, block_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotInCommunity,
    CannotBlockSelf,
    CannotBlockUser,
    CommunityNotPublic,
    NotAuthorized,
    TargetUserNotInCommunity,
    UserSuspended,
    CommunityFrozen,
    InternalError(String),
    UserLapsed,
    Error(u16, Option<String>),
}

impl From<crate::remove_member::Response> for Response {
    fn from(response: crate::remove_member::Response) -> Self {
        match response {
            crate::remove_member::Response::Success => Response::Success,
            crate::remove_member::Response::Error(error, reason) => Response::Error(error, reason),
            crate::remove_member::Response::UserNotInCommunity => Response::UserNotInCommunity,
            crate::remove_member::Response::CannotRemoveSelf => Response::CannotBlockSelf,
            crate::remove_member::Response::CannotRemoveUser => Response::CannotBlockUser,
            crate::remove_member::Response::InternalError(e) => Response::InternalError(e),
            crate::remove_member::Response::NotAuthorized => Response::NotAuthorized,
            crate::remove_member::Response::TargetUserNotInCommunity => Response::TargetUserNotInCommunity,
            crate::remove_member::Response::UserSuspended => Response::UserSuspended,
            crate::remove_member::Response::CommunityFrozen => Response::CommunityFrozen,
            crate::remove_member::Response::UserLapsed => Response::UserLapsed,
        }
    }
}
