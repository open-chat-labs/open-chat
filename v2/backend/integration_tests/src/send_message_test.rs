use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;
use types::{MessageContent, TextContent};

pub fn send_message_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(send_message_test_impl(handle, ctx));
}

async fn send_message_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone()).await;

    let (user1_id, user2_id) = futures::future::join(
        register_user(
            url.clone(),
            TestIdentity::User1,
            Some("Andy".to_string()),
            canister_ids.user_index,
        ),
        register_user(
            url.clone(),
            TestIdentity::User2,
            Some("Bob".to_string()),
            canister_ids.user_index,
        ),
    )
    .await;

    let user1_identity = build_identity(TestIdentity::User1);

    let agent = build_ic_agent(url, user1_identity).await;

    let send_message_args = user_canister::send_message::Args {
        message_id: 123.into(),
        recipient: user2_id,
        sender_name: "TEST!".to_string(),
        content: MessageContent::Text(TextContent { text: "abc".to_string() }),
        replies_to: None,
    };
    let send_message_result = send_direct_message(&agent, user1_id, &send_message_args).await;

    let events_args = user_canister::events_by_index::Args {
        user_id: user2_id,
        events: vec![send_message_result.event_index],
    };
    let get_events_response = user_canister_client::events_by_index(&agent, &user1_id.into(), &events_args).await;
    if let user_canister::events_by_index::Response::Success(r) = get_events_response {
        assert_eq!(r.events.len(), 1);
    } else {
        panic!("No events returned");
    }
}
