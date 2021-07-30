use crate::canisters::{CanisterId, CanisterWasm, GroupChatId};
use crate::utils::delay;
use candid::{CandidType, Decode, Encode, Principal};
use ic_agent::Agent;
use serde::Deserialize;

generate_update_call!(create_group);
generate_update_call!(notify_activity);

pub mod init {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        pub group_canister_wasm: CanisterWasm,
        pub notifications_canister_id: CanisterId,
    }
}

pub mod create_group {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        pub is_public: bool,
        pub creator_principal: Principal,
        pub name: String,
    }

    #[derive(CandidType, Deserialize)]
    pub enum Response {
        Success(SuccessResult),
        NameTaken,
        CyclesBalanceTooLow,
        InternalError,
    }

    #[derive(CandidType, Deserialize)]
    pub struct SuccessResult {
        pub group_id: GroupChatId,
    }
}

pub mod notify_activity {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {}

    #[derive(CandidType, Deserialize)]
    pub enum Response {
        Success,
        ChatNotFound,
    }
}
