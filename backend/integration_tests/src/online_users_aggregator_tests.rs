use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;
use std::{thread, time};

pub fn online_users_aggregator_tests(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    block_on(online_users_aggregator_tests_impl(handle, ctx));
}

async fn online_users_aggregator_tests_impl(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, _) = register_2_default_users(url.clone(), canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user2_identity = build_identity(TestIdentity::User2);

    let (user1_agent, user2_agent) = futures::future::join(
        build_ic_agent(url.clone(), user1_identity),
        build_ic_agent(url, user2_identity),
    )
    .await;

    let one_second = time::Duration::from_secs(1);
    thread::sleep(5 * one_second);

    print!("Mark user1 online in online_users_aggregator... ");
    let mark_as_online_args = online_users_aggregator_canister::mark_as_online::Args {};
    online_users_aggregator_canister_client::mark_as_online(
        &user1_agent,
        &canister_ids.online_users_aggregator,
        &mark_as_online_args,
    )
    .await
    .unwrap();
    println!("Ok");

    let get_user_args = user_index_canister::user::Args {
        user_id: Some(user1_id),
        username: None,
    };

    print!("Wait for user1 to be marked as online in user_index... ");
    let mut success = false;
    for i in 0..10 {
        print!("{i}... ");

        let seconds_since_last_online =
            match user_index_canister_client::user(&user2_agent, &canister_ids.user_index, &get_user_args)
                .await
                .unwrap()
            {
                user_index_canister::user::Response::Success(u) => u.seconds_since_last_online,
                response => panic!("User returned an error: {response:?}"),
            };

        if seconds_since_last_online < 5 {
            success = true;
            break;
        }
        thread::sleep(one_second);
    }
    assert!(success);
    println!("Ok");
}
