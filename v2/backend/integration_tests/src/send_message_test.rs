use crate::block_on;
use ic_fondue::ic_manager::IcHandle;
use types::{MessageContent, TextContent};
use canister_client::canisters;
use canister_client::operations::*;
use canister_client::TestIdentity;
use canister_client::utils::{build_identity, build_ic_agent};

pub fn send_message_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(send_message_test_impl(handle, ctx));
}

async fn send_message_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();

    let canister_ids = create_and_install_service_canisters(url.clone()).await;

    let user1_id = register_user(url.clone(), TestIdentity::User1, canister_ids.user_index).await;
    let user2_id = register_user(url.clone(), TestIdentity::User2, canister_ids.user_index).await;

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
    let get_events_response = canisters::user::events_by_index(&agent, &user1_id.into(), &events_args).await;
    if let user_canister::events_by_index::Response::Success(r) = get_events_response {
        assert_eq!(r.events.len(), 1);
    } else {
        panic!("No events returned");
    }
}
