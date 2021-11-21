use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;

pub fn register_user_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(register_user_tests_impl(handle, ctx));
}

async fn register_user_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    register_default_user(url, canister_ids.user_index).await;
}

pub fn register_existing_user_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(register_existing_user_tests_impl(handle, ctx));
}

async fn register_existing_user_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    register_default_user(url.clone(), canister_ids.user_index).await;

    let submit_phone_number_args = user_index_canister::submit_phone_number::Args {
        phone_number: types::PhoneNumber {
            country_code: 44,
            number: "07887123457".to_string(),
        },
    };

    let identity = build_identity(TestIdentity::User1);
    let agent = build_ic_agent(url, identity).await;
    let submit_phone_number_response =
        user_index_canister_client::submit_phone_number(&agent, &canister_ids.user_index, &submit_phone_number_args)
            .await
            .unwrap();

    assert!(matches!(
        submit_phone_number_response,
        user_index_canister::submit_phone_number::Response::AlreadyRegistered
    ));
}
