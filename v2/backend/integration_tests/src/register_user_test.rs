use crate::canisters::user_index::*;
use crate::utils::*;
use candid::Principal;
use fondue::pot;
use ic_agent::Identity;
use ic_fondue::ic_manager::{IcHandle, IcManager};
use ic_fondue::internet_computer::InternetComputer;
use ic_registry_subnet_type::SubnetType;

pub fn config() -> InternetComputer {
    InternetComputer::new().add_fast_single_node_subnet(SubnetType::System)
}

pub fn setup() -> pot::Setup<IcManager> {
    Box::new(|_man, _ctx| {})
}

pub fn register_user_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(register_user_test_impl(handle, ctx));
}

async fn register_user_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = &endpoint.url;

    let controller_identity = build_identity(TestIdentity::Controller);
    let controller_principal = controller_identity.sender().unwrap();
    let controller_agent = build_ic_agent(url.to_string(), controller_identity).await;
    let management_canister = build_management_canister(&controller_agent);

    let (user_index_canister_id,) = management_canister
        .create_canister()
        .as_provisional_create_with_amount(None)
        .call_and_wait(delay())
        .await
        .expect("Failed to create user index canister");

    let user_index_wasm_bytes = get_wasm_bytes(CanisterWasmName::UserIndex);
    let user_wasm_bytes = get_wasm_bytes(CanisterWasmName::User);

    let user_index_init_args = init::Args {
        service_principals: vec![controller_principal],
        sms_service_principals: Vec::new(),
        user_wasm_module: user_wasm_bytes,
        group_index_canister_id: Principal::anonymous(),
        test_mode: true
    };

    management_canister
        .install_code(&user_index_canister_id, &user_index_wasm_bytes)
        .with_arg(user_index_init_args)
        .call_and_wait(delay())
        .await
        .expect("Failed to install wasm");

    let user1_identity = build_identity(TestIdentity::User1);
    let user1_agent = build_ic_agent(url.to_string(), user1_identity).await;

    let submit_phone_number_args = submit_phone_number::Args {
        phone_number: submit_phone_number::UnvalidatedPhoneNumber {
            country_code: 44,
            number: "07887123456".to_string(),
        }
    };

    let submit_phone_number_response = submit_phone_number(&user1_agent, &user_index_canister_id, &submit_phone_number_args).await;

    assert!(matches!(submit_phone_number_response, submit_phone_number::Response::Success));

    let confirm_phone_number_args = confirm_phone_number::Args {
        confirmation_code: "123456".to_string(),
    };

    let confirm_phone_number_response = confirm_phone_number(&user1_agent, &user_index_canister_id, &confirm_phone_number_args).await;

    assert!(matches!(confirm_phone_number_response, confirm_phone_number::Response::Success));

    let create_canister_args = create_canister::Args {};

    let create_canister_response = create_canister(&user1_agent, &user_index_canister_id, &create_canister_args).await;

    if let create_canister::Response::Success(user_canister_id) = create_canister_response {
        println!("User canister created: {}", user_canister_id);
    } else {
        panic!("{:?}", create_canister_response);
    }
}
