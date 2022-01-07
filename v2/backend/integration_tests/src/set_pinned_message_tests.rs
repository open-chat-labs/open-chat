use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;
use std::panic;
use types::{ChatSummary, GroupChatEvent, MessageContent, TextContent};

pub fn set_pinned_message_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(set_pinned_message_tests_impl(handle, ctx));
}

async fn set_pinned_message_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, user2_id, user3_id) = register_3_default_users(url.clone(), canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user2_identity = build_identity(TestIdentity::User2);
    let user3_identity = build_identity(TestIdentity::User3);

    let (user1_agent, _user2_agent, _user3_agent) = futures::future::join3(
        build_ic_agent(url.clone(), user1_identity),
        build_ic_agent(url.clone(), user2_identity),
        build_ic_agent(url.clone(), user3_identity),
    )
    .await;

    let name = "TEST_NAME".to_string();
    let description = "TEST_DESCRIPTION".to_string();

    let args = user_canister::create_group::Args {
        is_public: false,
        name: name.clone(),
        description: description.clone(),
        avatar: None,
        history_visible_to_new_joiners: false,
    };

    let chat_id = create_group(&user1_agent, user1_id, &args, vec![user2_id, user3_id]).await;

    let send_message_args = group_canister::send_message::Args {
        message_id: 1.into(),
        sender_name: "TEST!".to_string(),
        content: MessageContent::Text(TextContent { text: "abc".to_string() }),
        replies_to: None,
        mentioned: Vec::new(),
    };
    let _ = send_group_message(&user1_agent, chat_id, &send_message_args).await;

    print!("Check that the Owner can set the pinned message... ");
    let set_pinned_message_args1 = group_canister::set_pinned_message::Args {
        message_index: Some(0.into()),
    };
    match group_canister_client::set_pinned_message(&user1_agent, &chat_id.into(), &set_pinned_message_args1)
        .await
        .unwrap()
    {
        group_canister::set_pinned_message::Response::Success => {}
        response => panic!("SetPinnedMessage returned an error: {:?}", response),
    };
    println!("Ok");

    print!("Check that the pinned message is set correctly... ");
    let initial_state_args = user_canister::initial_state::Args {};
    let initial_state_response = user_canister_client::initial_state(&user1_agent, &user1_id.into(), &initial_state_args)
        .await
        .unwrap();

    if let user_canister::initial_state::Response::Success(r) = initial_state_response {
        assert_eq!(r.chats.len(), 1);

        if let ChatSummary::Group(g) = &r.chats[0] {
            assert_eq!(g.pinned_message, Some(0.into()));
        } else {
            panic!("Expected a group chat to be returned");
        }
    }

    print!("Check the events were recorded correctly... ");
    let events_range_args = group_canister::events_range::Args {
        from_index: 0.into(),
        to_index: 10.into(),
    };
    match group_canister_client::events_range(&user1_agent, &chat_id.into(), &events_range_args)
        .await
        .unwrap()
    {
        group_canister::events_range::Response::Success(r) => {
            assert_eq!(r.events.len(), 4);
            assert!(matches!(r.events[0].event, GroupChatEvent::GroupChatCreated(_)));
            assert!(matches!(r.events[1].event, GroupChatEvent::ParticipantsAdded(_)));
            assert!(matches!(r.events[2].event, GroupChatEvent::Message(_)));
            assert!(matches!(r.events[3].event, GroupChatEvent::PinnedMessageUpdated(_)));
        }
        response => panic!("EventsRange returned an error: {:?}", response),
    };
    println!("Ok");
}
