use crate::utils::{
    build_ic_agent, build_identity, build_management_canister, delay, get_canister_wasm, CanisterWasmName, TestIdentity,
};
use candid::{CandidType, Principal};
use ic_agent::Identity;
use ic_utils::interfaces::ManagementCanister;
use ic_utils::Canister;
use serde::Deserialize;
use url::Url;

#[macro_use]
mod macros {
    macro_rules! generate_update_call {
        ($method_name:ident) => {
            pub async fn $method_name(
                agent: &Agent,
                canister_id: &Principal,
                args: &$method_name::Args,
            ) -> $method_name::Response {
                let method_name = stringify!($method_name);
                let response = agent
                    .update(canister_id, method_name)
                    .with_arg(Encode!(args).expect(&format!("Failed to serialize '{}' args", method_name)))
                    .call_and_wait(delay())
                    .await
                    .expect(&format!("Failed to call '{}'", method_name));

                Decode!(response.as_slice(), $method_name::Response)
                    .expect(&format!("Failed to deserialize '{}' response", method_name))
            }
        };
    }
}

#[allow(dead_code)]
pub mod group_index;
pub mod notifications;
pub mod user_index;

pub type CanisterId = Principal;

pub struct CanisterIds {
    pub user_index: Principal,
    pub group_index: Principal,
    pub notifications: Principal,
}

pub async fn create_and_install_all(url: &Url) -> CanisterIds {
    let identity = build_identity(TestIdentity::Controller);
    let principal = identity.sender().unwrap();
    let agent = build_ic_agent(url.to_string(), identity).await;
    let management_canister = build_management_canister(&agent);

    let user_index_canister_id = create_empty_canister(&management_canister).await;
    let group_index_canister_id = create_empty_canister(&management_canister).await;
    let notifications_canister_id = create_empty_canister(&management_canister).await;

    let user_index_canister_wasm = get_canister_wasm(CanisterWasmName::UserIndex);
    let user_canister_wasm = get_canister_wasm(CanisterWasmName::User);
    let user_index_init_args = user_index::init::Args {
        service_principals: vec![principal],
        sms_service_principals: Vec::new(),
        user_canister_wasm,
        group_index_canister_id,
        notifications_canister_id,
        test_mode: true,
    };
    install_wasm(
        &management_canister,
        &user_index_canister_id,
        &user_index_canister_wasm.module,
        user_index_init_args,
    )
    .await;

    let group_index_canister_wasm = get_canister_wasm(CanisterWasmName::GroupIndex);
    let group_canister_wasm = get_canister_wasm(CanisterWasmName::Group);
    let group_index_init_args = group_index::init::Args {
        group_canister_wasm,
        notifications_canister_id,
    };
    install_wasm(
        &management_canister,
        &group_index_canister_id,
        &group_index_canister_wasm.module,
        group_index_init_args,
    )
    .await;

    let notifications_canister_wasm = get_canister_wasm(CanisterWasmName::Notifications);
    let notifications_init_args = notifications::init::Args {
        push_service_principals: Vec::new(),
    };
    install_wasm(
        &management_canister,
        &notifications_canister_id,
        &notifications_canister_wasm.module,
        notifications_init_args,
    )
    .await;

    CanisterIds {
        user_index: user_index_canister_id,
        group_index: group_index_canister_id,
        notifications: notifications_canister_id,
    }
}

async fn create_empty_canister(management_canister: &Canister<'_, ManagementCanister>) -> Principal {
    let (canister_id,) = management_canister
        .create_canister()
        .as_provisional_create_with_amount(None)
        .call_and_wait(delay())
        .await
        .expect("Failed to create canister");

    canister_id
}

async fn install_wasm<A: CandidType + Sync + Send>(
    management_canister: &Canister<'_, ManagementCanister>,
    canister_id: &Principal,
    wasm_bytes: &[u8],
    init_args: A,
) {
    management_canister
        .install_code(canister_id, wasm_bytes)
        .with_arg(init_args)
        .call_and_wait(delay())
        .await
        .expect("Failed to install wasm");
}

#[derive(CandidType, Deserialize, Clone)]
pub struct CanisterWasm {
    #[serde(with = "serde_bytes")]
    pub module: Vec<u8>,
    pub version: Version,
}

#[derive(CandidType, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq)]
pub struct Version {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl Version {
    pub fn new(major: u32, minor: u32, patch: u32) -> Version {
        Version { major, minor, patch }
    }
}

#[derive(CandidType, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct DirectChatId([u8; 29]);

#[derive(CandidType, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct GroupChatId(CanisterId);
