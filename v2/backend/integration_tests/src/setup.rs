use crate::canisters::{self, CanisterIds};
use crate::utils::{
    build_ic_agent, build_identity, build_management_canister, delay, get_canister_wasm, CanisterWasmName, TestIdentity,
};
use candid::{CandidType, Principal};
use ic_agent::Identity;
use ic_utils::interfaces::ManagementCanister;
use ic_utils::Canister;
use types::CanisterId;

pub async fn create_and_install_service_canisters(url: String) -> CanisterIds {
    let identity = build_identity(TestIdentity::Controller);
    let principal = identity.sender().unwrap();
    let agent = build_ic_agent(url, identity).await;
    let management_canister = build_management_canister(&agent);

    let user_index_canister_id = create_empty_canister(&management_canister).await;
    let group_index_canister_id = create_empty_canister(&management_canister).await;
    let notifications_canister_id = create_empty_canister(&management_canister).await;

    let user_index_canister_wasm = get_canister_wasm(CanisterWasmName::UserIndex);
    let user_canister_wasm = get_canister_wasm(CanisterWasmName::User);
    let user_index_init_args = user_index_canister::lifecycle::init::Args {
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
    let group_index_init_args = group_index_canister::lifecycle::init::Args {
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
    let notifications_init_args = notifications_canister::lifecycle::init::Args {
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

pub async fn register_user(url: String, user_identity: TestIdentity, user_index_canister_id: CanisterId) -> CanisterId {
    let phone_number_suffix = match &user_identity {
        TestIdentity::User1 => "1",
        TestIdentity::User2 => "2",
        TestIdentity::User3 => "3",
        _ => "0",
    };

    let identity = build_identity(user_identity);
    let agent = build_ic_agent(url, identity).await;

    let submit_phone_number_args = user_index_canister::updates::submit_phone_number::Args {
        phone_number: user_index_canister::updates::submit_phone_number::UnvalidatedPhoneNumber {
            country_code: 44,
            number: format!("0711100000{}", phone_number_suffix),
        },
    };

    let submit_phone_number_response =
        canisters::user_index::submit_phone_number(&agent, &user_index_canister_id, &submit_phone_number_args).await;

    assert!(matches!(
        submit_phone_number_response,
        user_index_canister::updates::submit_phone_number::Response::Success
    ));

    let confirm_phone_number_args = user_index_canister::updates::confirm_phone_number::Args {
        confirmation_code: "123456".to_string(),
    };

    let confirm_phone_number_response =
        canisters::user_index::confirm_phone_number(&agent, &user_index_canister_id, &confirm_phone_number_args).await;

    assert!(matches!(
        confirm_phone_number_response,
        user_index_canister::updates::confirm_phone_number::Response::Success
    ));

    let create_canister_args = user_index_canister::updates::create_canister::Args {};

    let create_canister_response =
        canisters::user_index::create_canister(&agent, &user_index_canister_id, &create_canister_args).await;

    if let user_index_canister::updates::create_canister::Response::Success(user_canister_id) = create_canister_response {
        user_canister_id
    } else {
        panic!("{:?}", create_canister_response);
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
