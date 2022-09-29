use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_agent::Agent;
use ic_fondue::ic_manager::IcHandle;
use types::CanisterId;
use user_index_canister::current_user::PhoneStatus;

pub fn verify_user_tests(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    block_on(verify_user_tests_impl(handle, ctx));
}

async fn verify_user_tests_impl(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let user_id = register_default_user(url.clone(), canister_ids.user_index).await;
    println!("user_id: {user_id:?}");

    let user_identity = build_identity(TestIdentity::User1);
    let user_agent = build_ic_agent(url.clone(), user_identity).await;

    {
        print!("1. submit_phone_number... ");
        let args = user_index_canister::submit_phone_number::Args {
            phone_number: types::PhoneNumber {
                country_code: 44,
                number: "07887123457".to_string(),
            },
        };
        let response = user_index_canister_client::submit_phone_number(&user_agent, &canister_ids.user_index, &args)
            .await
            .unwrap();
        assert!(matches!(
            response,
            user_index_canister::submit_phone_number::Response::Success
        ));
        println!("Ok");
    }
    {
        print!("2. current_user... ");
        match current_user(&user_agent, &canister_ids.user_index).await {
            user_index_canister::current_user::Response::Success(u) => {
                assert!(matches!(u.phone_status, PhoneStatus::Unconfirmed(_)));
                assert_eq!(u.open_storage_limit_bytes, 0);
            }
            response => panic!("CurrentUser returned an unexpected response: {response:?}"),
        };
        println!("Ok - phone_status == Unconfirmed");
    }
    {
        print!("3. submit_phone_number again... ");
        let args = user_index_canister::submit_phone_number::Args {
            phone_number: types::PhoneNumber {
                country_code: 44,
                number: "07887123457".to_string(),
            },
        };
        let response = user_index_canister_client::submit_phone_number(&user_agent, &canister_ids.user_index, &args)
            .await
            .unwrap();
        assert!(matches!(
            response,
            user_index_canister::submit_phone_number::Response::Success
        ));
        println!("Ok");
    }
    {
        print!("4. confirm_phone_number... ");
        let args = user_index_canister::confirm_phone_number::Args {
            confirmation_code: "123456".to_owned(),
        };
        let response = user_index_canister_client::confirm_phone_number(&user_agent, &canister_ids.user_index, &args)
            .await
            .unwrap();
        assert!(matches!(
            response,
            user_index_canister::confirm_phone_number::Response::Success(_)
        ));
        println!("Ok");
    }
    {
        print!("5. current_user... ");
        match current_user(&user_agent, &canister_ids.user_index).await {
            user_index_canister::current_user::Response::Success(u) => {
                assert!(matches!(u.phone_status, PhoneStatus::Confirmed));
                assert!(u.open_storage_limit_bytes > 0);
            }
            response => panic!("CurrentUser returned an unexpected response: {response:?}"),
        };
        // Check storage limit
        println!("Ok - phone_status == Confirmed");
    }
}

async fn current_user(agent: &Agent, canister_id: &CanisterId) -> user_index_canister::current_user::Response {
    let current_user_args = user_index_canister::current_user::Args {};
    user_index_canister_client::current_user(agent, canister_id, &current_user_args)
        .await
        .unwrap()
}
