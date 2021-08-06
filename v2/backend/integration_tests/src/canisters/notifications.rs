use candid::{CandidType, Principal};
use serde::Deserialize;

pub mod init {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        pub push_service_principals: Vec<Principal>,
    }
}
