use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_agent::Agent;
use ic_fondue::ic_manager::IcHandle;
use std::panic;
use types::{ChatSummary, GroupChatEvent, Role, UserId};

pub fn make_admin_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(make_admin_tests_impl(handle, ctx));
}

async fn make_admin_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
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
    };

    let chat_id = create_group(&user1_agent, user1_id, &args, vec![user2_id, user3_id]).await;

    print!("Check that the Owner can make another user an admin... ");
    let make_user2_admin_args = group_canister::make_admin::Args { user_id: user2_id };
    match group_canister_client::make_admin(&user1_agent, &chat_id.into(), &make_user2_admin_args)
        .await
        .unwrap()
    {
        group_canister::make_admin::Response::Success => {}
        response => panic!("MakeAdmin returned an error: {response:?}"),
    };
    println!("Ok");

    print!("Check that user2 is now an admin... ");
    if let Some(role) = user_role(user2_id, &user2_agent).await {
        assert!(matches!(role, Role::Admin))
    } else {
        assert!(false);
    }
    println!("Ok");

    print!("Check that an admin can make another user an admin... ");
    let make_user3_admin_args = group_canister::make_admin::Args { user_id: user3_id };
    match group_canister_client::make_admin(&user2_agent, &chat_id.into(), &make_user3_admin_args)
        .await
        .unwrap()
    {
        group_canister::make_admin::Response::Success => {}
        response => panic!("MakeAdmin returned an error: {response:?}"),
    };
    println!("Ok");

    print!("Check that an admin can't dismiss the owner as admin... ");
    let dismiss_user1_as_admin_args = group_canister::dismiss_admin::Args { user_id: user1_id };
    match group_canister_client::dismiss_admin(&user2_agent, &chat_id.into(), &dismiss_user1_as_admin_args)
        .await
        .unwrap()
    {
        group_canister::dismiss_admin::Response::UserNotAdmin => {}
        response => panic!("DismissAdmin returned an unexpected response: {response:?}"),
    };
    println!("Ok");

    print!("Check that an admin can't dismiss themselves as admin... ");
    let dismiss_user2_as_admin_args = group_canister::dismiss_admin::Args { user_id: user2_id };
    match group_canister_client::dismiss_admin(&user2_agent, &chat_id.into(), &dismiss_user2_as_admin_args)
        .await
        .unwrap()
    {
        group_canister::dismiss_admin::Response::CannotDismissSelf => {}
        group_canister::dismiss_admin::Response::Success => {
            panic!("User should not have been able to dismiss themselves as admin");
        }
        response => panic!("DismissAdmin returned an error: {response:?}"),
    };
    println!("Ok");

    print!("Check that an admin can dismiss another admin as admin... ");
    let dismiss_user3_as_admin_args = group_canister::dismiss_admin::Args { user_id: user3_id };
    match group_canister_client::dismiss_admin(&user2_agent, &chat_id.into(), &dismiss_user3_as_admin_args)
        .await
        .unwrap()
    {
        group_canister::dismiss_admin::Response::Success => {}
        response => panic!("DismissAdmin returned an error: {response:?}"),
    };
    println!("Ok");

    print!("Check that user3 is no longer an admin... ");
    if let Some(role) = user_role(user3_id, &user3_agent).await {
        assert!(matches!(role, Role::Participant))
    } else {
        assert!(false);
    }
    println!("Ok");

    print!("Check that the owner can dismiss another admin as admin... ");
    let dismiss_user2_as_admin_args = group_canister::dismiss_admin::Args { user_id: user2_id };
    match group_canister_client::dismiss_admin(&user1_agent, &chat_id.into(), &dismiss_user2_as_admin_args)
        .await
        .unwrap()
    {
        group_canister::dismiss_admin::Response::Success => {}
        response => panic!("DismissAdmin returned an error: {response:?}"),
    };
    println!("Ok");

    print!("Check that user2 is no longer an admin... ");
    if let Some(role) = user_role(user2_id, &user2_agent).await {
        assert!(matches!(role, Role::Participant))
    } else {
        assert!(false);
    }
    println!("Ok");

    print!("Check that a non-admin is not able to make another user an admin... ");
    match group_canister_client::make_admin(&user2_agent, &chat_id.into(), &make_user3_admin_args).await {
        Err(error) if { format!("{error:?}").contains("403") } => {}
        response => panic!("MakeAdmin should have returned 403 but did not: {response:?}"),
    };
    println!("Ok");

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
            assert_eq!(r.events.len(), 6);
            assert!(matches!(r.events[0].event, GroupChatEvent::GroupChatCreated(_)));
            assert!(matches!(r.events[1].event, GroupChatEvent::ParticipantsAdded(_)));
            assert!(matches!(r.events[2].event, GroupChatEvent::ParticipantsPromotedToAdmin(_)));
            assert!(matches!(r.events[3].event, GroupChatEvent::ParticipantsPromotedToAdmin(_)));
            assert!(matches!(r.events[4].event, GroupChatEvent::ParticipantsDismissedAsAdmin(_)));
            assert!(matches!(r.events[5].event, GroupChatEvent::ParticipantsDismissedAsAdmin(_)));
        }
        response => panic!("EventsRange returned an error: {response:?}"),
    };
    println!("Ok");
}

async fn user_role(user_id: UserId, agent: &Agent) -> Option<Role> {
    let args = user_canister::initial_state::Args {};
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
