use crate::canisters;
use crate::setup::{create_and_install_service_canisters, register_user};
use crate::utils::*;
use ic_fondue::ic_manager::IcHandle;

pub fn create_group_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(create_group_test_impl(handle, ctx));
}

async fn create_group_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();

    let canister_ids = create_and_install_service_canisters(url.clone()).await;

    let user1_id = register_user(url.clone(), TestIdentity::User1, canister_ids.user_index).await;
    let user2_id = register_user(url.clone(), TestIdentity::User2, canister_ids.user_index).await;
    let user3_id = register_user(url.clone(), TestIdentity::User3, canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);

    let agent = build_ic_agent(url, user1_identity).await;

    let create_group_args = user_canister::updates::create_group::Args {
        is_public: false,
        name: "TEST_GROUP".to_string(),
    };
    let create_group_response = canisters::user::create_group(&agent, &user1_id, &create_group_args).await;

    if let user_canister::updates::create_group::Response::Success(r) = create_group_response {
        let add_participants_args = group_canister::updates::add_participants::Args {
            user_ids: vec![user2_id.into(), user3_id.into()],
        };
        let add_participants_response =
            canisters::group::add_participants(&agent, &r.group_chat_id.into(), &add_participants_args).await;
        if !matches!(
            add_participants_response,
            group_canister::updates::add_participants::Response::Success
        ) {
            panic!("Add participants returned an error: {:?}", add_participants_response);
        }
    } else {
        panic!("Create group returned an error: {:?}", create_group_response);
    }
}
