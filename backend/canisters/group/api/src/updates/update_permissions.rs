use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::PermissionRole;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub change_permissions: Option<PermissionRole>,
    pub change_roles: Option<PermissionRole>,
    pub add_members: Option<PermissionRole>,
    pub remove_members: Option<PermissionRole>,
    pub block_users: Option<PermissionRole>,
    pub delete_messages: Option<PermissionRole>,
    pub update_group: Option<PermissionRole>,
    pub pin_messages: Option<PermissionRole>,
    pub invite_users: Option<PermissionRole>,
    pub create_polls: Option<PermissionRole>,
    pub send_messages: Option<PermissionRole>,
    pub react_to_messages: Option<PermissionRole>,
    pub reply_in_thread: Option<PermissionRole>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CallerNotInGroup,
}
