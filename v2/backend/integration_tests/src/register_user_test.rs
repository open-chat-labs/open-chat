use crate::canisters::user_index;
use crate::setup::{create_and_install_service_canisters, register_user};
use crate::utils::*;
use ic_fondue::ic_manager::IcHandle;

pub fn register_user_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(register_user_test_impl(handle, ctx));
}

async fn register_user_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();

    let canister_ids = create_and_install_service_canisters(url.clone()).await;

    register_user(url, TestIdentity::User1, canister_ids.user_index).await;
}

pub fn register_existing_user_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(register_existing_user_test_impl(handle, ctx));
}

async fn register_existing_user_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();

    let canister_ids = create_and_install_service_canisters(url.clone()).await;

    register_user(url.clone(), TestIdentity::User1, canister_ids.user_index).await;

    let submit_phone_number_args = user_index_canister::submit_phone_number::Args {
        phone_number: user_index_canister::submit_phone_number::UnvalidatedPhoneNumber {
            country_code: 44,
            number: "07887123457".to_string(),
        },
    };

    let identity = build_identity(TestIdentity::User1);
    let agent = build_ic_agent(url, identity).await;
    let submit_phone_number_response =
        user_index::submit_phone_number(&agent, &canister_ids.user_index, &submit_phone_number_args).await;

    assert!(matches!(
        submit_phone_number_response,
        user_index_canister::submit_phone_number::Response::AlreadyRegistered
    ));
}
