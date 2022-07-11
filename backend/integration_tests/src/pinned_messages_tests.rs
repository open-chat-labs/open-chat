use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;
use std::panic;
use types::{ChatEvent, EventIndex, MessageContent, Role, TextContent};

pub fn pinned_messages_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(pinned_messages_tests_impl(handle, ctx));
}

async fn pinned_messages_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, user2_id) = register_2_default_users(url.clone(), canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user2_identity = build_identity(TestIdentity::User2);

    let (user1_agent, user2_agent) = futures::future::join(
        build_ic_agent(url.clone(), user1_identity),
        build_ic_agent(url.clone(), user2_identity),
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
        permissions: None,
    };

    let chat_id = create_group(&user1_agent, user1_id, &args, vec![user2_id]).await;

    let send_message_args1 = group_canister::send_message::Args {
        thread_root_message_index: None,
        message_id: 1.into(),
        sender_name: "TEST!".to_string(),
        content: MessageContent::Text(TextContent { text: "abc".to_string() }),
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
    };
    let _ = send_group_message(&user1_agent, chat_id, &send_message_args1).await;

    let send_message_args2 = group_canister::send_message::Args {
        thread_root_message_index: None,
        message_id: 2.into(),
        sender_name: "TEST!".to_string(),
        content: MessageContent::Text(TextContent { text: "xyz".to_string() }),
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
    };
    let _ = send_group_message(&user1_agent, chat_id, &send_message_args2).await;

    print!("1. Check that the Owner can pin a message... ");
    let pin_message_args1 = group_canister::pin_message::Args { message_index: 0.into() };
    match group_canister_client::pin_message(&user1_agent, &chat_id.into(), &pin_message_args1)
        .await
        .unwrap()
    {
        group_canister::pin_message::Response::Success(_) => {}
        response => panic!("pin_message returned an error: {response:?}"),
    };
    println!("Ok");

    print!("2. Check that a participant can't pin a message... ");
    let pin_message_args2 = group_canister::pin_message::Args { message_index: 1.into() };
    match group_canister_client::pin_message(&user2_agent, &chat_id.into(), &pin_message_args2).await {
        Err(error) if format!("{error:?}").contains("403") => {}
        response => panic!("pin_message did not return 403 as expected: {response:?}"),
    };
    println!("Ok");

    print!("3. Making user2 an admin... ");
    let change_role_args = group_canister::change_role::Args {
        user_id: user2_id,
        new_role: Role::Admin,
    };
    match group_canister_client::change_role(&user1_agent, &chat_id.into(), &change_role_args)
        .await
        .unwrap()
    {
        group_canister::change_role::Response::Success => {}
        response => panic!("change_role returned an error: {response:?}"),
    };
    println!("Ok");

    let pin_message_event_index: EventIndex;
    print!("4. Check that an admin can pin a message... ");
    match group_canister_client::pin_message(&user2_agent, &chat_id.into(), &pin_message_args2)
        .await
        .unwrap()
    {
        group_canister::pin_message::Response::Success(event_index) => {
            pin_message_event_index = event_index;
        }
        response => panic!("pin_message returned an error: {response:?}"),
    };
    println!("Ok");

    print!("5. Check the NoChange case... ");
    match group_canister_client::pin_message(&user2_agent, &chat_id.into(), &pin_message_args2)
        .await
        .unwrap()
    {
        group_canister::pin_message::Response::NoChange => {}
        response => panic!("pin_message returned an error: {response:?}"),
    };
    println!("Ok");

    print!("6. Check the MessageIndexOutOfRange case... ");
    let pin_message_args3 = group_canister::pin_message::Args { message_index: 2.into() };
    match group_canister_client::pin_message(&user2_agent, &chat_id.into(), &pin_message_args3)
        .await
        .unwrap()
    {
        group_canister::pin_message::Response::MessageIndexOutOfRange => {}
        response => panic!("pin_message returned an error: {response:?}"),
    };
    println!("Ok");

    print!("7. Check that the pinned messages are set correctly... ");
    let selected_initial_args = group_canister::selected_initial::Args {};
    match group_canister_client::selected_initial(&user1_agent, &chat_id.into(), &selected_initial_args)
        .await
        .unwrap()
    {
        group_canister::selected_initial::Response::Success(r) => {
            assert_eq!(r.pinned_messages, vec![0.into(), 1.into()]);
        }
        response => panic!("selected_initial returned an error: {response:?}"),
    }
    println!("Ok");

    print!("8. Check that messages can be unpinned... ");
    let unpin_message_args = group_canister::unpin_message::Args { message_index: 0.into() };
    match group_canister_client::unpin_message(&user1_agent, &chat_id.into(), &unpin_message_args)
        .await
        .unwrap()
    {
        group_canister::unpin_message::Response::Success(_) => {}
        response => panic!("unpin_message returned an error: {response:?}"),
    };
    println!("Ok");

    print!("9. Check that the chat updates show the unpinned message... ");
    let selected_updates_args = group_canister::selected_updates::Args {
        updates_since: pin_message_event_index,
    };
    match group_canister_client::selected_updates(&user1_agent, &chat_id.into(), &selected_updates_args)
        .await
        .unwrap()
    {
        group_canister::selected_updates::Response::Success(r) => {
            assert_eq!(r.pinned_messages_removed, vec![0.into()]);
        }
        response => panic!("selected_updates returned an error: {response:?}"),
    }

    print!("10. Check the events were recorded correctly... ");
    let events_range_args = group_canister::events_range::Args {
        thread_root_message_index: None,
        from_index: 0.into(),
        to_index: 10.into(),
        invite_code: None,
    };
    match group_canister_client::events_range(&user1_agent, &chat_id.into(), &events_range_args)
        .await
        .unwrap()
    {
        group_canister::events_range::Response::Success(r) => {
            assert_eq!(r.events.len(), 8);
            assert!(matches!(r.events[0].event, ChatEvent::GroupChatCreated(_)));
            assert!(matches!(r.events[1].event, ChatEvent::ParticipantsAdded(_)));
            assert!(matches!(r.events[2].event, ChatEvent::Message(_)));
            assert!(matches!(r.events[3].event, ChatEvent::Message(_)));
            assert!(matches!(r.events[4].event, ChatEvent::MessagePinned(_)));
            assert!(matches!(r.events[5].event, ChatEvent::RoleChanged(_)));
            assert!(matches!(r.events[6].event, ChatEvent::MessagePinned(_)));
            assert!(matches!(r.events[7].event, ChatEvent::MessageUnpinned(_)));
        }
        response => panic!("events_range returned an error: {response:?}"),
    };
    println!("Ok");
}
