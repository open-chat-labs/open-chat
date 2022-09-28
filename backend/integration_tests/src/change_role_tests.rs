use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_agent::Agent;
use ic_fondue::ic_manager::IcHandle;
use std::panic;
use types::{ChatEvent, ChatId, ChatSummary, GroupRules, Role, UserId};

pub fn change_role_tests(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    block_on(change_role_tests_impl(handle, ctx));
}

async fn change_role_tests_impl(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, user2_id, user3_id) = register_3_default_users(url.clone(), canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user2_identity = build_identity(TestIdentity::User2);
    let user3_identity = build_identity(TestIdentity::User3);

    let (user1_agent, user2_agent, user3_agent) = futures::future::join3(
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
        rules: GroupRules::default(),
        subtype: None,
    };

    // User1 is owner and user2 and user3 are participants
    let chat_id = create_group(&user1_agent, user1_id, &args, vec![user2_id, user3_id]).await;

    {
        print!("1. Confirm that the Owner can make another user an admin... ");
        match change_role(chat_id, user2_id, Role::Admin, &user1_agent).await {
            group_canister::change_role::Response::Success => {}
            response => panic!("change_role returned an error: {response:?}"),
        };
        println!("Ok");
    }
    {
        print!("2. Confirm that user2 is now an admin... ");
        if let Some(role) = user_role(user2_id, &user2_agent).await {
            assert!(matches!(role, Role::Admin))
        } else {
            panic!("user_role return None");
        }
        println!("Ok");
    }
    {
        print!("3. Confirm that an admin can make another user an admin... ");
        match change_role(chat_id, user3_id, Role::Admin, &user2_agent).await {
            group_canister::change_role::Response::Success => {}
            response => panic!("change_role returned an unexpected response: {response:?}"),
        };
        println!("Ok");
    }
    {
        print!("4. Confirm that an admin can't dismiss the owner as admin... ");
        match change_role(chat_id, user1_id, Role::Participant, &user2_agent).await {
            group_canister::change_role::Response::Invalid => {}
            response => panic!("change_role returned an unexpected response: {response:?}"),
        };
        println!("Ok");
    }
    {
        print!("5. Confirm that an admin can dismiss another admin as admin... ");
        match change_role(chat_id, user3_id, Role::Participant, &user2_agent).await {
            group_canister::change_role::Response::Success => {}
            response => panic!("change_role returned an unexpected response: {response:?}"),
        };
        println!("Ok");
    }
    {
        print!("6. Confirm that user3 is no longer an admin... ");
        if let Some(role) = user_role(user3_id, &user3_agent).await {
            assert!(matches!(role, Role::Participant))
        } else {
            panic!("user_role return None");
        }
        println!("Ok");
    }
    {
        print!("7. Confirm that the owner can dismiss another admin as admin... ");
        match change_role(chat_id, user2_id, Role::Participant, &user1_agent).await {
            group_canister::change_role::Response::Success => {}
            response => panic!("change_role returned an unexpected response: {response:?}"),
        };
        println!("Ok");
    }
    {
        print!("8. Confirm that user2 is now a participant... ");
        if let Some(role) = user_role(user2_id, &user2_agent).await {
            assert!(matches!(role, Role::Participant))
        } else {
            panic!("user_role return None");
        }
        println!("Ok");
    }
    {
        print!("9. Confirm that a non-admin is not able to make another user an admin... ");
        let args = group_canister::change_role::Args {
            user_id: user3_id,
            new_role: Role::Admin,
        };
        match group_canister_client::change_role(&user2_agent, &chat_id.into(), &args).await {
            Err(error) if format!("{error:?}").contains("403") => {}
            response => panic!("MakeAdmin should have returned 403 but did not: {response:?}"),
        };
        println!("Ok");
    }
    {
        print!("10. Confirm that the owner can transfer ownership... ");
        match change_role(chat_id, user2_id, Role::Owner, &user1_agent).await {
            group_canister::change_role::Response::Success => {}
            response => panic!("change_role returned an unexpected response: {response:?}"),
        };
        println!("Ok");
    }
    {
        print!("11. Confirm the events were recorded correctly... ");
        let events_range_args = group_canister::events_range::Args {
            thread_root_message_index: None,
            from_index: 0.into(),
            to_index: 10.into(),
            invite_code: None,
            latest_client_event_index: None,
        };
        match group_canister_client::events_range(&user1_agent, &chat_id.into(), &events_range_args)
            .await
            .unwrap()
        {
            group_canister::events_range::Response::Success(r) => {
                assert_eq!(r.events.len(), 7);
                assert!(matches!(r.events[0].event, ChatEvent::GroupChatCreated(_)));
                assert!(matches!(r.events[1].event, ChatEvent::ParticipantsAdded(_)));
                assert!(matches!(r.events[2].event, ChatEvent::RoleChanged(_)));
                assert!(matches!(r.events[3].event, ChatEvent::RoleChanged(_)));
                assert!(matches!(r.events[4].event, ChatEvent::RoleChanged(_)));
                assert!(matches!(r.events[5].event, ChatEvent::RoleChanged(_)));
                assert!(matches!(r.events[6].event, ChatEvent::OwnershipTransferred(_)));
            }
            response => panic!("events_range returned an error: {response:?}"),
        };
        println!("Ok");
    }
}

async fn user_role(user_id: UserId, agent: &Agent) -> Option<Role> {
    let args = user_canister::initial_state::Args { disable_cache: None };
    match user_canister_client::initial_state(agent, &user_id.into(), &args)
        .await
        .unwrap()
    {
        user_canister::initial_state::Response::Success(r) => {
            if let ChatSummary::Group(group_chat_summary) = &r.chats[0] {
                Some(group_chat_summary.role)
            } else {
                None
            }
        }
        response => panic!("user::initial_state returned an error: {response:?}"),
    }
}

async fn change_role(
    group_id: ChatId,
    user_id: UserId,
    new_role: Role,
    agent: &Agent,
) -> group_canister::change_role::Response {
    let args = group_canister::change_role::Args { user_id, new_role };
    group_canister_client::change_role(agent, &group_id.into(), &args)
        .await
        .unwrap()
}
