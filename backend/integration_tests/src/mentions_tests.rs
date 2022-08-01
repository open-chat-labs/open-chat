use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_agent::Agent;
use ic_fondue::ic_manager::IcHandle;
use std::panic;
use types::{
    CanisterId, ChatEvent, ChatSummary, ChatSummaryUpdates, MessageContent, SubscriptionInfo, SubscriptionKeys, TextContent,
    User, UserId,
};
use user_canister::updates::{GroupChatUpdatesSince, UpdatesSince};

pub fn mentions_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(mentions_tests_impl(handle, ctx));
}

async fn mentions_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, user2_id, user3_id) = register_3_default_users(url.clone(), canister_ids.user_index).await;
    println!("user1_id: {user1_id:?}");
    println!("user2_id: {user2_id:?}");
    println!("user3_id: {user3_id:?}");

    let controller_identity = build_identity(TestIdentity::Controller);
    let user1_identity = build_identity(TestIdentity::User1);
    let user2_identity = build_identity(TestIdentity::User2);
    let user3_identity = build_identity(TestIdentity::User3);

    let (controller_agent, user1_agent, user2_agent, user3_agent) = futures::future::join4(
        build_ic_agent(url.clone(), controller_identity),
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
        permissions: None,
    };

    let chat_id = create_group(&user1_agent, user1_id, &args, vec![user2_id, user3_id]).await;
    println!("chat_id: {chat_id:?}");

    {
        print!("1. Subscribe all 3 users to receive notifications... ");
        subscribe_to_notifications(user1_id, &user1_agent, &canister_ids.notifications).await;
        subscribe_to_notifications(user2_id, &user2_agent, &canister_ids.notifications).await;
        subscribe_to_notifications(user3_id, &user3_agent, &canister_ids.notifications).await;
        println!("Ok");
    }

    {
        print!("2. Mute group notifications for user1... ");
        let args = user_canister::mute_notifications::Args { chat_id };
        match user_canister_client::mute_notifications(&user1_agent, &user1_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::mute_notifications::Response::Success => {}
            response => panic!("user::mute_notifications returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("3. User2 sends a group message... ");
        let args = group_canister::send_message::Args {
            thread_root_message_index: None,
            message_id: 3546125412536152673_u128.into(),
            content: MessageContent::Text(TextContent {
                text: "Hello world".to_owned(),
            }),
            sender_name: "user2".to_owned(),
            replies_to: None,
            mentioned: vec![],
            forwarding: false,
        };
        send_group_message(&user2_agent, chat_id, &args).await;
        println!("Ok");
    }

    {
        print!("4. Confirm notification is generated in notifications canister for user3 only... ");
        let args = notifications_canister::notifications::Args {
            from_notification_index: 0,
        };
        let response = notifications_canister_client::notifications(&controller_agent, &canister_ids.notifications, &args)
            .await
            .unwrap();
        let notifications_canister::notifications::Response::Success(result) = response;
        assert_eq!(result.notifications.len(), 1);
        assert_eq!(result.notifications[0].value.recipients, vec![user3_id]);
        println!("Ok");
    }

    {
        print!("5. User2 sends a group message mentioning user1... ");
        let args = group_canister::send_message::Args {
            thread_root_message_index: None,
            message_id: 734979238479237_u128.into(),
            content: MessageContent::Text(TextContent {
                text: format!("Hello @UserId({user1_id})"),
            }),
            sender_name: "user2".to_owned(),
            replies_to: None,
            mentioned: vec![User {
                user_id: user1_id,
                username: "Matt".to_owned(),
            }],
            forwarding: false,
        };
        send_group_message(&user2_agent, chat_id, &args).await;
        println!("Ok");
    }

    {
        print!("6. Confirm notification is generated in notifications canister for user1 and user3... ");
        let args = notifications_canister::notifications::Args {
            from_notification_index: 2,
        };
        let response = notifications_canister_client::notifications(&controller_agent, &canister_ids.notifications, &args)
            .await
            .unwrap();
        let notifications_canister::notifications::Response::Success(result) = response;
        assert_eq!(result.notifications.len(), 1);
        let recipients = &result.notifications[0].value.recipients;
        assert!(recipients.contains(&user1_id));
        assert!(recipients.contains(&user3_id));
        println!("Ok");
    }

    let last_updated;
    {
        print!("7. Confirm user::initial_state contains the mention... ");
        let args = user_canister::initial_state::Args {};
        match user_canister_client::initial_state(&user1_agent, &user1_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::initial_state::Response::Success(r) => {
                assert_eq!(r.chats.len(), 1);
                last_updated = Some(r.timestamp);
                if let ChatSummary::Group(group_chat_summary) = &r.chats[0] {
                    assert_eq!(group_chat_summary.mentions.len(), 1);
                    assert_eq!(group_chat_summary.mentions[0].message_index, 1.into());
                } else {
                    assert!(false);
                }
            }
            response => panic!("user::initial_state returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("8. User2 sends another group message mentioning user1... ");
        let args = group_canister::send_message::Args {
            thread_root_message_index: None,
            message_id: 9723892378497238947_u128.into(),
            content: MessageContent::Text(TextContent {
                text: format!("Hello again @UserId({user1_id})"),
            }),
            sender_name: "user2".to_owned(),
            replies_to: None,
            mentioned: vec![User {
                user_id: user1_id,
                username: "Matt".to_owned(),
            }],
            forwarding: false,
        };
        send_group_message(&user2_agent, chat_id, &args).await;
        println!("Ok");
    }

    {
        print!("9. Confirm user::updates contains the new mention only... ");
        let last_updated = last_updated.unwrap();
        let args = user_canister::updates::Args {
            updates_since: UpdatesSince {
                timestamp: last_updated,
                group_chats: vec![GroupChatUpdatesSince {
                    chat_id,
                    updates_since: last_updated,
                }],
            },
        };
        match user_canister_client::updates(&user1_agent, &user1_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::updates::Response::Success(r) => {
                assert!(r.chats_added.is_empty());
                assert_eq!(r.chats_updated.len(), 1);
                if let ChatSummaryUpdates::Group(group_chat_summary) = &r.chats_updated[0] {
                    assert_eq!(group_chat_summary.mentions.len(), 1);
                    assert_eq!(group_chat_summary.mentions[0].message_index, 2.into());
                } else {
                    assert!(false);
                }
            }
            response => panic!("user::updates returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("10. Confirm group events were recorded correctly... ");
        let args = group_canister::events_range::Args {
            thread_root_message_index: None,
            from_index: 0.into(),
            to_index: 10.into(),
            invite_code: None,
        };
        match group_canister_client::events_range(&user1_agent, &chat_id.into(), &args)
            .await
            .unwrap()
        {
            group_canister::events_range::Response::Success(r) => {
                assert_eq!(r.events.len(), 5);
                assert!(matches!(r.events[0].event, ChatEvent::GroupChatCreated(_)));
                assert!(matches!(r.events[1].event, ChatEvent::ParticipantsAdded(_)));
                assert!(matches!(r.events[2].event, ChatEvent::Message(_)));
                assert!(matches!(r.events[3].event, ChatEvent::Message(_)));
                assert!(matches!(r.events[4].event, ChatEvent::Message(_)));
            }
            response => panic!("EventsRange returned an error: {response:?}"),
        };

        println!("Ok");
    }
}

async fn subscribe_to_notifications(user_id: UserId, agent: &Agent, canister_id: &CanisterId) {
    let args = notifications_canister::push_subscription::Args {
        subscription: SubscriptionInfo {
            endpoint: "endpoint".to_owned(),
            keys: SubscriptionKeys {
                p256dh: format!("p256dh_{user_id}"),
                auth: "auth".to_owned(),
            },
        },
    };

    notifications_canister_client::push_subscription(agent, canister_id, &args)
        .await
        .unwrap();
}
