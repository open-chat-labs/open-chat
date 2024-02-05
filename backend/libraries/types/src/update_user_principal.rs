use crate::UserId;
use candid::{Deserialize, Principal};
use serde::Serialize;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateUserPrincipalArgs {
    pub user_id: UserId,
    pub old_principal: Principal,
    pub new_principal: Principal,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum UpdateUserPrincipalResponse {
    Success,
}
