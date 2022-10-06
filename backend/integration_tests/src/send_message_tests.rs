use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;
use types::{MessageContent, TextContent};

pub fn send_message_tests(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    block_on(send_message_tests_impl(handle, ctx));
}

async fn send_message_tests_impl(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, user2_id) = register_2_default_users(url.clone(), canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);

    let agent = build_ic_agent(url, user1_identity).await;

    let send_message_args = user_canister::send_message::Args {
        recipient: user2_id,
        thread_root_message_index: None,
        message_id: 1.into(),
        sender_name: "TEST!".to_string(),
        content: MessageContent::Text(TextContent { text: "abc".to_string() }),
        replies_to: None,
        forwarding: false,
        correlation_id: 0,
    };
    let send_message_result = send_direct_message(&agent, user1_id, &send_message_args).await;

    let events_args = user_canister::events_by_index::Args {
        user_id: user2_id,
        thread_root_message_index: None,
        events: vec![send_message_result.event_index],
        latest_client_event_index: None,
    };
    let get_events_response = user_canister_client::events_by_index(&agent, &user1_id.into(), &events_args)
        .await
        .unwrap();

    if let user_canister::events_by_index::Response::Success(r) = get_events_response {
        assert_eq!(r.events.len(), 1);
    } else {
        panic!("No events returned");
    }

    let send_message_args = user_canister::send_message::Args {
        recipient: user2_id,
        thread_root_message_index: None,
        message_id: 2.into(),
        sender_name: "TEST!".to_string(),
        content: MessageContent::Text(TextContent { text: String::default() }),
        replies_to: None,
        forwarding: false,
        correlation_id: 0,
    };
    let response = user_canister_client::send_message(&agent, &user1_id.into(), &send_message_args)
        .await
        .unwrap();
    if !matches!(response, user_canister::send_message::Response::MessageEmpty) {
        panic!("SendMessage was expected to return MessageEmpty but did not: {response:?}");
    }

    let send_message_args = user_canister::send_message::Args {
        recipient: user2_id,
        thread_root_message_index: None,
        message_id: 3.into(),
        sender_name: "TEST!".to_string(),
        content: MessageContent::Text(TextContent {
            text: (0..5001).into_iter().map(|_| '1').collect(),
        }),
        replies_to: None,
        forwarding: false,
        correlation_id: 0,
    };
    let response = user_canister_client::send_message(&agent, &user1_id.into(), &send_message_args)
        .await
        .unwrap();
    if !matches!(response, user_canister::send_message::Response::TextTooLong(5000)) {
        panic!("SendMessage was expected to return TextTooLong(5000) but did not: {response:?}");
    }
}
