use candid::CandidType;
use ts_export::ts_export;
use types::{CommunityId, UserId};

#[ts_export(local_user_index, invite_users_to_community)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub user_ids: Vec<UserId>,
    pub caller_username: String,
}

#[ts_export(local_user_index, invite_users_to_community)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    UserNotInCommunity,
    NotAuthorized,
    CommunityFrozen,
    TooManyInvites(u32),
    UserSuspended,
    InternalError(String),
}
