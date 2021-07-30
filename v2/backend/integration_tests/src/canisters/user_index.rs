use crate::utils::delay;
use candid::{CandidType, Decode, Encode, Principal};
use ic_agent::Agent;
use serde::Deserialize;

generate_update_call!(submit_phone_number);
generate_update_call!(confirm_phone_number);
generate_update_call!(create_canister);

pub mod init {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        // Only these principals can call update_wasm
        pub service_principals: Vec<Principal>,

        // Only these principals can call pending_sms_messages
        pub sms_service_principals: Vec<Principal>,

        // The initial wasm module for creating user canisters
        #[serde(with = "serde_bytes")]
        pub user_wasm_module: Vec<u8>,

        pub group_index_canister_id: Principal,

        // Accepts confirmation code 123456
        pub test_mode: bool,
    }
}

pub mod submit_phone_number {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        pub phone_number: UnvalidatedPhoneNumber,
    }

    #[derive(CandidType, Deserialize)]
    pub struct UnvalidatedPhoneNumber {
        pub country_code: u16,
        pub number: String,
    }

    #[derive(CandidType, Deserialize)]
    pub enum Response {
        Success,
        AlreadyRegistered,
        AlreadyRegisteredByOther,
        InvalidPhoneNumber,
    }
}

pub mod confirm_phone_number {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        pub confirmation_code: String,
    }

    #[derive(CandidType, Deserialize)]
    pub enum Response {
        Success,
        ConfirmationCodeIncorrect,
        ConfirmationCodeExpired,
        AlreadyClaimed,
        UserNotFound,
    }
}

pub mod create_canister {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {}

    #[derive(CandidType, Deserialize, Debug)]
    pub enum Response {
        Success(Principal),
        UserNotFound,
        UserUnconfirmed,
        UserAlreadyCreated,
        CreationInProgress,
        CyclesBalanceTooLow,
        InternalError(String),
    }
}