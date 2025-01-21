use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SwapAlreadyAccepted,
    SwapExpired,
    SwapNotFound,
    NotAuthorized,
}
