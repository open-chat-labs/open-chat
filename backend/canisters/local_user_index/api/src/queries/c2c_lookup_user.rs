use candid::Principal;
use serde::{Deserialize, Serialize};

use crate::GlobalUser;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id_or_principal: Principal,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(GlobalUser),
    UserNotFound,
}
