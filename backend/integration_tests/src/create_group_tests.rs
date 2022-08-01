use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_agent::Agent;
use ic_fondue::ic_manager::IcHandle;
use std::cmp::min;
use types::{CanisterId, ChatId, ChatSummary, UserId};

pub fn create_group_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(create_group_tests_impl(handle, ctx));
}

async fn create_group_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
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

    let users = Users {
        user1_id,
        user1_agent,
        user2_id,
        user2_agent,
        user3_id,
        user3_agent,
    };

    let _chat_id1 = create_and_validate_group("AAA PRIVATE".to_string(), false, &users).await;
    let chat_id2 = create_and_validate_group("AAA PUBLIC".to_string(), true, &users).await;
    let chat_id3 = create_and_validate_group("BBB PUBLIC".to_string(), true, &users).await;

    println!("Ensure only public groups are searchable");
    search_groups(
        &users.user1_agent,
        canister_ids.group_index,
        "AAA".to_string(),
        10,
        vec![chat_id2],
    )
    .await;

    println!("Ensure multiple matches can be found");
    search_groups(
        &users.user1_agent,
        canister_ids.group_index,
        "PUBLIC".to_string(),
        10,
        vec![chat_id2, chat_id3],
    )
    .await;

    println!("Ensure max_results is honoured");
    search_groups(
        &users.user1_agent,
        canister_ids.group_index,
        "PUBLIC".to_string(),
        1,
        vec![chat_id2, chat_id3],
    )
    .await;
}

async fn create_and_validate_group(name: String, is_public: bool, users: &Users) -> ChatId {
    let description = format!("{name} description");

    let args = user_canister::create_group::Args {
        is_public,
        name: name.clone(),
        description: description.clone(),
        avatar: None,
        history_visible_to_new_joiners: !is_public,
        permissions: None,
    };

    let members = if is_public { Vec::new() } else { vec![users.user2_id, users.user3_id] };

    let chat_id = create_group(&users.user1_agent, users.user1_id, &args, members).await;

    if is_public {
        let join_group_args = user_canister::join_group_v2::Args {
            chat_id,
            as_super_admin: false,
            invite_code: None,
        };
        futures::future::join(
            join_group(&users.user2_agent, users.user2_id, &join_group_args),
            join_group(&users.user3_agent, users.user3_id, &join_group_args),
        )
        .await;
    }

    let args = user_canister::initial_state::Args {};
    match user_canister_client::initial_state(&users.user1_agent, &users.user1_id.into(), &args)
        .await
        .unwrap()
    {
        user_canister::initial_state::Response::Success(r) => {
            if let Some(ChatSummary::Group(group_chat_summary)) = &r.chats.iter().find(|c| c.chat_id() == chat_id) {
                assert_eq!(group_chat_summary.chat_id, chat_id);
                assert_eq!(group_chat_summary.name, name);
                assert_eq!(group_chat_summary.description, description);
                assert_eq!(group_chat_summary.is_public, is_public);
            } else {
                panic!("Group not found in InitialState response. Response: {r:?}");
            }
        }
        response => panic!("user::initial_state returned an error: {response:?}"),
    }

    futures::future::join3(
        ensure_user_canister_links_to_group(&users.user1_agent, users.user1_id, chat_id),
        ensure_user_canister_links_to_group(&users.user2_agent, users.user2_id, chat_id),
        ensure_user_canister_links_to_group(&users.user3_agent, users.user3_id, chat_id),
    )
    .await;

    chat_id
}

async fn search_groups(
    agent: &Agent,
    group_index_canister_id: CanisterId,
    search_term: String,
    max_results: u8,
    all_matches: Vec<ChatId>,
) {
    let search_args = group_index_canister::search::Args {
        search_term,
        max_results,
    };
    if let Ok(group_index_canister::search::Response::Success(result)) =
        group_index_canister_client::search(agent, &group_index_canister_id, &search_args).await
    {
        let matches: Vec<_> = result.matches.into_iter().map(|m| m.chat_id).collect();
        assert_eq!(matches.len(), min(max_results as usize, all_matches.len()));
        assert!(matches.iter().all(|m| all_matches.contains(m)));
    }
}

async fn ensure_user_canister_links_to_group(agent: &Agent, user_id: UserId, chat_id: ChatId) {
    let args = user_canister::initial_state::Args {};
    match user_canister_client::initial_state(agent, &user_id.into(), &args)
        .await
        .unwrap()
    {
        user_canister::initial_state::Response::Success(r) => {
            if let Some(ChatSummary::Group(g)) = r.chats.into_iter().find(|c| c.chat_id() == chat_id) {
                assert_eq!(g.chat_id, chat_id);
            } else {
                panic!("Group chat not found");
            }
        }
        response => panic!("InitialState returned an error: {response:?}"),
    };
}

struct Users {
    user1_id: UserId,
    user1_agent: Agent,
    user2_id: UserId,
    user2_agent: Agent,
    user3_id: UserId,
    user3_agent: Agent,
}
