use candid::Principal;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub on_behalf_of: Option<Principal>,
}

pub type Response = super::summary::Response;
