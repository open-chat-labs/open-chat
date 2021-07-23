use crate::model::confirmation_code_sms::ConfirmationCodeSms;
use crate::model::user_map::UserMap;
use candid::Principal;
use phonenumber::PhoneNumber;
use shared::canisters::canister_wasm::CanisterWasm;
use std::collections::HashSet;
use std::collections::VecDeque;

pub const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 60 * 60 * 1000; // 1 hour

#[derive(Default)]
pub struct Data {
    pub users: UserMap,
    pub service_principals: HashSet<Principal>,
    pub user_wasm: CanisterWasm,
    pub sms_service_principals: HashSet<Principal>,
    pub sms_queue: VecDeque<ConfirmationCodeSms>,
}

impl Data {
    pub fn new(service_principals: Vec<Principal>, sms_service_principals: Vec<Principal>, user_wasm_module: Vec<u8>) -> Self {
        Data {
            users: UserMap::default(),
            service_principals: service_principals.into_iter().collect(),
            user_wasm: CanisterWasm {
                module: user_wasm_module,
                version: semver::Version::new(0, 0, 0),
            },
            sms_service_principals: sms_service_principals.into_iter().collect(),
            sms_queue: VecDeque::default(),
        }
    }
}

pub fn append_sms_to_queue(queue: &mut VecDeque<ConfirmationCodeSms>, phone_number: PhoneNumber, confirmation_code: String) {
    let index = queue.front().map_or(0, |s| s.index + 1);
    let sms = ConfirmationCodeSms {
        phone_number: phone_number.to_string(),
        confirmation_code,
        index,
    };
    queue.push_front(sms);
}
