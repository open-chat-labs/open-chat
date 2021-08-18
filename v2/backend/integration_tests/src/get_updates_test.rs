use crate::canisters;
use crate::setup::{create_and_install_service_canisters, register_user, create_group, send_group_message, send_direct_message};
use crate::utils::*;
use ic_fondue::ic_manager::IcHandle;
use types::{MessageContent, TextContent};

pub fn get_updates_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(get_updates_test_impl(handle, ctx));
}

async fn get_updates_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();

    let canister_ids = create_and_install_service_canisters(url.clone()).await;

    let user1_id = register_user(url.clone(), TestIdentity::User1, canister_ids.user_index).await;
    let user2_id = register_user(url.clone(), TestIdentity::User2, canister_ids.user_index).await;
    let user3_id = register_user(url.clone(), TestIdentity::User3, canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user1_agent = build_ic_agent(url.clone(), user1_identity).await;

    let user2_identity = build_identity(TestIdentity::User2);
    let user2_agent = build_ic_agent(url, user2_identity).await;
    let user2_name = "User2".to_string();

    let create_group_args1 = user_canister::create_group::Args {
        is_public: false,
        name: "TEST_NAME1".to_string(),
        description: "TEST_DESCRIPTION1".to_string(),
    };
    let group_chat_id1 = create_group(&user1_agent, user1_id, create_group_args1, vec![user2_id, user3_id]).await;

    let create_group_args2 = user_canister::create_group::Args {
        is_public: false,
        name: "TEST_NAME2".to_string(),
        description: "TEST_DESCRIPTION2".to_string(),
    };
    let group_chat_id2 = create_group(&user1_agent, user1_id, create_group_args2, vec![user2_id, user3_id]).await;

    let direct_message_args1 = user_canister::send_message::Args {
        message_id: 1.into(),
        recipient: user1_id,
        sender_name: user2_name.clone(),
        content: MessageContent::Text(TextContent { text: "1".to_string() }),
        replies_to: None,
    };
    let result1 = send_direct_message(&user2_agent, user2_id, &direct_message_args1).await;

    let direct_message_args2 = user_canister::send_message::Args {
        message_id: 2.into(),
        recipient: user1_id,
        sender_name: user2_name.clone(),
        content: MessageContent::Text(TextContent { text: "2".to_string() }),
        replies_to: None,
    };
    let _result2 = send_direct_message(&user2_agent, user2_id, &direct_message_args2).await;

    let group_message_args1 = group_canister::send_message::Args {
        message_id: 3.into(),
        content: MessageContent::Text(TextContent { text: "3".to_string() }),
        sender_name: "User2".to_string(),
        replies_to: None,
    };
    let result3 = send_group_message(&user2_agent, group_chat_id1, &group_message_args1).await;

    let group_message_args2 = group_canister::send_message::Args {
        message_id: 4.into(),
        content: MessageContent::Text(TextContent { text: "4".to_string() }),
        sender_name: "User2".to_string(),
        replies_to: None,
    };
    let result4 = send_group_message(&user2_agent, group_chat_id2, &group_message_args2).await;

    let updates_args1 = user_canister::updates::Args {
        updates_since: None,
    };
    let updates_response1 = canisters::user::updates(&user1_agent, &user1_id.into(), &updates_args1).await;

    if let user_canister::updates::Response::Success(r) = updates_response1 {
        assert!(r.updated_chats.is_empty());
        assert_eq!(r.new_chats.len(), 3);

        let updates_args2 = user_canister::updates::Args {
            updates_since: Some(user_canister::updates::UpdatesSince {
                timestamp: result1.timestamp,
                group_chats: vec![
                    user_canister::updates::GroupChatUpdatesSince {
                        chat_id: group_chat_id1,
                        updates_since: result3.timestamp - 1,
                    },
                    user_canister::updates::GroupChatUpdatesSince {
                        chat_id: group_chat_id2,
                        updates_since: result4.timestamp,
                    },
                ],
            })
        };
        let updates_response2 = canisters::user::updates(&user1_agent, &user1_id.into(), &updates_args2).await;

        if let user_canister::updates::Response::Success(r) = updates_response2 {
            assert_eq!(r.updated_chats.len(), 2, "{:?}", r);
            assert!(r.new_chats.is_empty(), "{:?}", r);
        } else {
            panic!("Updates returned an error: {:?}", updates_response2);
        }
    } else {
        panic!("Updates returned an error: {:?}", updates_response1);
    }
}
