use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::{TestIdentity, USER2_DEFAULT_NAME};
use ic_fondue::ic_manager::IcHandle;
use types::{GroupRules, MessageContent, TextContent};

pub fn get_updates_tests(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    block_on(get_updates_tests_impl(handle, ctx));
}

async fn get_updates_tests_impl(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, user2_id, user3_id) = register_3_default_users(url.clone(), canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user2_identity = build_identity(TestIdentity::User2);

    let (user1_agent, user2_agent) = futures::future::join(
        build_ic_agent(url.clone(), user1_identity),
        build_ic_agent(url, user2_identity),
    )
    .await;

    let create_group_args1 = user_canister::create_group::Args {
        is_public: false,
        name: "TEST_NAME1".to_string(),
        description: "TEST_DESCRIPTION1".to_string(),
        avatar: None,
        history_visible_to_new_joiners: false,
        permissions: None,
        rules: GroupRules::default(),
        subtype: None,
    };
    let chat_id1 = create_group(&user1_agent, user1_id, &create_group_args1, vec![user2_id, user3_id]).await;

    let create_group_args2 = user_canister::create_group::Args {
        is_public: false,
        name: "TEST_NAME2".to_string(),
        description: "TEST_DESCRIPTION2".to_string(),
        avatar: None,
        history_visible_to_new_joiners: false,
        permissions: None,
        rules: GroupRules::default(),
        subtype: None,
    };
    let chat_id2 = create_group(&user1_agent, user1_id, &create_group_args2, vec![user2_id, user3_id]).await;

    let direct_message_args1 = user_canister::send_message::Args {
        recipient: user1_id,
        thread_root_message_index: None,
        message_id: 1.into(),
        sender_name: USER2_DEFAULT_NAME.to_string(),
        content: MessageContent::Text(TextContent { text: "1".to_string() }),
        replies_to: None,
        forwarding: false,
    };
    let result1 = send_direct_message(&user2_agent, user2_id, &direct_message_args1).await;

    let direct_message_args2 = user_canister::send_message::Args {
        recipient: user1_id,
        thread_root_message_index: None,
        message_id: 2.into(),
        sender_name: USER2_DEFAULT_NAME.to_string(),
        content: MessageContent::Text(TextContent { text: "2".to_string() }),
        replies_to: None,
        forwarding: false,
    };
    let _result2 = send_direct_message(&user2_agent, user2_id, &direct_message_args2).await;

    let group_message_args1 = group_canister::send_message::Args {
        thread_root_message_index: None,
        message_id: 3.into(),
        content: MessageContent::Text(TextContent { text: "3".to_string() }),
        sender_name: USER2_DEFAULT_NAME.to_string(),
        replies_to: None,
        mentioned: vec![],
        forwarding: false,
    };
    let result3 = send_group_message(&user2_agent, chat_id1, &group_message_args1).await;

    let group_message_args2 = group_canister::send_message::Args {
        thread_root_message_index: None,
        message_id: 4.into(),
        content: MessageContent::Text(TextContent { text: "4".to_string() }),
        sender_name: USER2_DEFAULT_NAME.to_string(),
        replies_to: None,
        mentioned: vec![],
        forwarding: false,
    };
    let result4 = send_group_message(&user2_agent, chat_id2, &group_message_args2).await;

    let initial_state_args = user_canister::initial_state::Args { disable_cache: None };
    let initial_state_response = user_canister_client::initial_state(&user1_agent, &user1_id.into(), &initial_state_args)
        .await
        .unwrap();

    if let user_canister::initial_state::Response::Success(r) = initial_state_response {
        assert_eq!(r.chats.len(), 3);

        let updates_args = user_canister::updates::Args {
            updates_since: user_canister::updates::UpdatesSince {
                timestamp: result1.timestamp,
                group_chats: vec![
                    user_canister::updates::GroupChatUpdatesSince {
                        chat_id: chat_id1,
                        updates_since: result3.timestamp - 1,
                    },
                    user_canister::updates::GroupChatUpdatesSince {
                        chat_id: chat_id2,
                        updates_since: result4.timestamp,
                    },
                ],
            },
        };
        let updates_response = user_canister_client::updates(&user1_agent, &user1_id.into(), &updates_args)
            .await
            .unwrap();

        if let user_canister::updates::Response::Success(r) = updates_response {
            assert_eq!(r.chats_updated.len(), 2, "{r:?}");
            assert!(r.chats_added.is_empty(), "{r:?}");
        } else {
            panic!("Updates returned an error: {updates_response:?}");
        }
    } else {
        panic!("InitialState returned an error: {initial_state_response:?}");
    }
}
