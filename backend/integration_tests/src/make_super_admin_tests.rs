use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::{TestIdentity, USER2_DEFAULT_NAME};
use ic_fondue::ic_manager::IcHandle;
use std::{panic, thread, time};
use types::{ChatEvent, ChatSummary, GroupRules, Role};

pub fn make_super_admin_tests(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
    block_on(make_super_admin_tests_impl(handle, ctx));
}

async fn make_super_admin_tests_impl(handle: IcHandle, ctx: &ic_fondue::pot::Context) {
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
        rules: GroupRules::default(),
        subtype: None,
    };

    // User1 is owner and user2 is a participant
    let chat_id = create_group(&user1_agent, user1_id, &args, vec![user2_id]).await;
    println!("chat_id: {chat_id:?}");

    {
        print!("1. Controller make user3 a super admin... ");
        let args = user_index_canister::add_super_admin::Args { user_id: user3_id };
        match user_index_canister_client::add_super_admin(&controller_agent, &canister_ids.user_index, &args)
            .await
            .unwrap()
        {
            user_index_canister::add_super_admin::Response::Success => {}
            response => panic!("user_index::add_super_admin returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("2. Confirm user3 is the only SuperAdmin... ");
        let args = user_index_canister::super_admins::Args {};
        let response = user_index_canister_client::super_admins(&controller_agent, &canister_ids.user_index, &args)
            .await
            .unwrap();
        let user_index_canister::super_admins::Response::Success(result) = response;
        assert!(result.users.len() == 1);
        assert!(result.users[0] == user3_id);
        println!("Ok");
    }

    {
        print!("3. User3 try to join the private group... ");
        let args = user_canister::join_group_v2::Args {
            chat_id,
            as_super_admin: false,
            invite_code: None,
            correlation_id: 0,
        };
        match user_canister_client::join_group_v2(&user3_agent, &user3_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::join_group_v2::Response::GroupNotPublic => {}
            response => panic!("user::join_group_v2 did not return GroupNotPublic: {response:?}"),
        };
        println!("Failed as expected");
    }

    {
        print!("4. User3 join the private group as a SuperAdmin... ");
        let args = user_canister::join_group_v2::Args {
            chat_id,
            as_super_admin: true,
            invite_code: None,
            correlation_id: 0,
        };
        match user_canister_client::join_group_v2(&user3_agent, &user3_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::join_group_v2::Response::Success(_) => {}
            response => panic!("user::join_group_v2 did not return Success: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("5. Confirm that user3 is now a super admin... ");
        let args = user_canister::initial_state::Args { disable_cache: None };
        match user_canister_client::initial_state(&user3_agent, &user3_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::initial_state::Response::Success(r) => {
                assert_eq!(r.chats.len(), 1);
                if let ChatSummary::Group(group_chat_summary) = &r.chats[0] {
                    assert!(matches!(group_chat_summary.role, Role::SuperAdmin(_)))
                } else {
                    panic!();
                }
            }
            response => panic!("user::initial_state returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("6. User3 transfer ownership from user1 to user2... ");
        let args = group_canister::change_role::Args {
            user_id: user2_id,
            new_role: Role::Owner,
            correlation_id: 0,
        };
        match group_canister_client::change_role(&user3_agent, &chat_id.into(), &args)
            .await
            .unwrap()
        {
            group_canister::change_role::Response::Success => {}
            response => panic!("group::change_role returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("7. User3 leave the group... ");
        let args = user_canister::leave_group::Args {
            chat_id,
            correlation_id: 0,
        };
        match user_canister_client::leave_group(&user3_agent, &user3_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::leave_group::Response::Success => {}
            response => panic!("user::leave_group did not return Success: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("8. User2 add user3 back to group as a participant... ");
        let args = group_canister::add_participants::Args {
            user_ids: vec![user3_id],
            added_by_name: USER2_DEFAULT_NAME.to_string(),
            allow_blocked_users: false,
            correlation_id: 0,
        };
        match group_canister_client::add_participants(&user2_agent, &chat_id.into(), &args)
            .await
            .unwrap()
        {
            group_canister::add_participants::Response::Success => {}
            response => panic!("group::add_participants returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("9. User3 assume SuperAdmin role... ");
        let args = user_canister::assume_group_super_admin::Args {
            chat_id,
            correlation_id: 0,
        };
        match user_canister_client::assume_group_super_admin(&user3_agent, &user3_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::assume_group_super_admin::Response::Success => {}
            response => panic!("user::assume_group_super_admin returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("10. User3 remove user1... ");
        let args = group_canister::remove_participant::Args {
            user_id: user1_id,
            correlation_id: 0,
        };
        match group_canister_client::remove_participant(&user3_agent, &chat_id.into(), &args)
            .await
            .unwrap()
        {
            group_canister::remove_participant::Response::Success => {}
            response => panic!("group::remove_participant returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("11. User3 relinquish SuperAdmin... ");
        let args = user_canister::relinquish_group_super_admin::Args {
            chat_id,
            correlation_id: 0,
        };
        match user_canister_client::relinquish_group_super_admin(&user3_agent, &user3_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::relinquish_group_super_admin::Response::Success => {}
            response => panic!("user::relinquish_group_super_admin returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("12. User3 try to remove user2... ");
        let args = group_canister::remove_participant::Args {
            user_id: user2_id,
            correlation_id: 0,
        };
        match group_canister_client::remove_participant(&user3_agent, &chat_id.into(), &args).await {
            Err(error) if format!("{error:?}").contains("403") => {}
            response => panic!("group::remove_participant did not return 403 as expected: {response:?}"),
        };
        println!("Failed as expected");
    }

    {
        print!("13. User3 assume SuperAdmin role... ");
        let args = user_canister::assume_group_super_admin::Args {
            chat_id,
            correlation_id: 0,
        };
        match user_canister_client::assume_group_super_admin(&user3_agent, &user3_id.into(), &args)
            .await
            .unwrap()
        {
            user_canister::assume_group_super_admin::Response::Success => {}
            response => panic!("user::assume_group_super_admin returned an error: {response:?}"),
        };
        println!("Ok");
    }

    {
        print!("14. Controller remove user3 as a super admin... ");
        let args = user_index_canister::remove_super_admin::Args { user_id: user3_id };
        match user_index_canister_client::remove_super_admin(&controller_agent, &canister_ids.user_index, &args)
            .await
            .unwrap()
        {
            user_index_canister::remove_super_admin::Response::Success => {}
            response => panic!("user_index::remove_super_admin returned an error: {response:?}"),
        };

        println!("Ok");
    }

    {
        print!("15. Confirm the list of super admins is empty... ");
        let args = user_index_canister::super_admins::Args {};
        let response = user_index_canister_client::super_admins(&controller_agent, &canister_ids.user_index, &args)
            .await
            .unwrap();
        let user_index_canister::super_admins::Response::Success(result) = response;
        assert!(result.users.is_empty());
        println!("Ok");
    }

    {
        print!("16. Wait for user3 to be dismissed as an admin by user_index::heartbeat... ");
        let one_second = time::Duration::from_secs(1);
        for i in 0..20 {
            print!("{i}... ");

            let args = user_canister::initial_state::Args { disable_cache: None };
            match user_canister_client::initial_state(&user3_agent, &user3_id.into(), &args)
                .await
                .unwrap()
            {
                user_canister::initial_state::Response::Success(r) => {
                    if let ChatSummary::Group(group_chat_summary) = &r.chats[0] {
                        if !matches!(group_chat_summary.role, Role::SuperAdmin(_)) {
                            break;
                        }
                    } else {
                        panic!();
                    }
                }
                response => panic!("user::initial_state returned an error: {response:?}"),
            };

            thread::sleep(one_second);
        }
        println!("Ok");
    }

    {
        print!("17. Check group events were recorded correctly... ");
        let events_range_args = group_canister::events_range::Args {
            thread_root_message_index: None,
            from_index: 0.into(),
            to_index: 20.into(),
            invite_code: None,
            latest_client_event_index: None,
        };
        match group_canister_client::events_range(&user2_agent, &chat_id.into(), &events_range_args)
            .await
            .unwrap()
        {
            group_canister::events_range::Response::Success(r) => {
                assert_eq!(r.events.len(), 11);
                assert!(matches!(r.events[0].event, ChatEvent::GroupChatCreated(_)));
                assert!(matches!(r.events[1].event, ChatEvent::ParticipantsAdded(_)));
                assert!(matches!(r.events[2].event, ChatEvent::ParticipantJoined(_)));
                assert!(matches!(r.events[3].event, ChatEvent::OwnershipTransferred(_)));
                assert!(matches!(r.events[4].event, ChatEvent::ParticipantLeft(_)));
                assert!(matches!(r.events[5].event, ChatEvent::ParticipantsAdded(_)));
                assert!(matches!(r.events[6].event, ChatEvent::ParticipantAssumesSuperAdmin(_)));
                assert!(matches!(r.events[7].event, ChatEvent::ParticipantsRemoved(_)));
                assert!(matches!(r.events[8].event, ChatEvent::ParticipantRelinquishesSuperAdmin(_)));
                assert!(matches!(r.events[9].event, ChatEvent::ParticipantAssumesSuperAdmin(_)));
                assert!(matches!(r.events[10].event, ChatEvent::ParticipantDismissedAsSuperAdmin(_)));
            }
            response => panic!("EventsRange returned an error: {response:?}"),
        };

        println!("Ok");
    }
}
