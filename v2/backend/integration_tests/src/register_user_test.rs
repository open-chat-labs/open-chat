use crate::canisters::create_and_install_all;
use crate::canisters::user_index::*;
use crate::utils::*;
use fondue::pot;
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

    let canister_ids = create_and_install_all(url).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user1_agent = build_ic_agent(url.to_string(), user1_identity).await;

    let submit_phone_number_args = submit_phone_number::Args {
        phone_number: submit_phone_number::UnvalidatedPhoneNumber {
            country_code: 44,
            number: "07887123456".to_string(),
        },
    };

    let submit_phone_number_response =
        submit_phone_number(&user1_agent, &canister_ids.user_index, &submit_phone_number_args).await;

    assert!(matches!(submit_phone_number_response, submit_phone_number::Response::Success));

    let confirm_phone_number_args = confirm_phone_number::Args {
        confirmation_code: "123456".to_string(),
    };

    let confirm_phone_number_response =
        confirm_phone_number(&user1_agent, &canister_ids.user_index, &confirm_phone_number_args).await;

    assert!(matches!(
        confirm_phone_number_response,
        confirm_phone_number::Response::Success
    ));

    let create_canister_args = create_canister::Args {};

    let create_canister_response = create_canister(&user1_agent, &canister_ids.user_index, &create_canister_args).await;

    if let create_canister::Response::Success(user_canister_id) = create_canister_response {
        println!("User canister created: {}", user_canister_id);
    } else {
        panic!("{:?}", create_canister_response);
    }
}
