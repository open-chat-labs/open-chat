use candid::CandidType;
use serde::Deserialize;
use types::PermissionRole;

#[derive(CandidType, Deserialize, Debug)]
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
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CallerNotInGroup,
}
