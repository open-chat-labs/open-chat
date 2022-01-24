use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity, build_management_canister};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;
use types::{Cryptocurrency, Cycles, RegistrationFee};

pub fn register_user_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(register_user_tests_impl(handle, ctx));
}

async fn register_user_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    gated_register_default_user(url, canister_ids.user_index).await;
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

    gated_register_default_user(url.clone(), canister_ids.user_index).await;

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

pub fn register_user_by_paying_cycles_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(register_user_by_paying_cycles_tests_impl(handle, ctx));
}

async fn register_user_by_paying_cycles_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let identity = build_identity(TestIdentity::User1);
    let agent = build_ic_agent(url.clone(), identity).await;
    let management_canister = build_management_canister(&agent);
    let cycles_wallet_canister_id = create_cycles_wallet(&management_canister).await;

    print!("Generating a cycles registration fee... ");
    let fee: Cycles;
    let generate_registration_fee_args = user_index_canister::generate_registration_fee::Args {
        currency: Cryptocurrency::Cycles,
    };
    match user_index_canister_client::generate_registration_fee(
        &agent,
        &canister_ids.user_index,
        &generate_registration_fee_args,
    )
    .await
    .unwrap()
    {
        user_index_canister::generate_registration_fee::Response::Success(r) => {
            if let RegistrationFee::Cycles(f) = r.fee {
                assert_eq!(f.recipient, canister_ids.user_index);
                fee = f.amount;
            } else {
                panic!("GenerateRegistrationFee returned an unexpected response: {r:?}");
            }
        }
        response => panic!("GenerateRegistrationFee returned an error: {response:?}"),
    };
    println!("Ok");

    print!("Sending cycles to the user index... ");
    send_cycles(&agent, &cycles_wallet_canister_id, canister_ids.user_index, fee).await;
    println!("Ok");

    print!("Checking that the user is now confirmed... ");
    let current_user_args = user_index_canister::current_user::Args {};
    match user_index_canister_client::current_user(&agent, &canister_ids.user_index, &current_user_args)
        .await
        .unwrap()
    {
        user_index_canister::current_user::Response::ConfirmedPendingUsername(_) => {}
        response => panic!("CurrentUser returned an unexpected response: {response:?}"),
    };
    println!("Ok");
}
