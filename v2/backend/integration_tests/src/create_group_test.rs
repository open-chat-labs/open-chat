use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_agent::Agent;
use ic_fondue::ic_manager::IcHandle;
use types::{ChatId, ChatSummary, UserId};

pub fn create_group_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(create_group_test_impl(handle, ctx));
}

async fn create_group_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
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

    let args = user_canister::initial_state::Args {};
    match user_canister_client::initial_state(&user1_agent, &user1_id.into(), &args)
        .await
        .unwrap()
    {
        user_canister::initial_state::Response::Success(r) => {
            if let ChatSummary::Group(group_chat_summary) = &r.chats[0] {
                assert_eq!(group_chat_summary.chat_id, chat_id);
                assert_eq!(group_chat_summary.name, name);
                assert_eq!(group_chat_summary.description, description);
                assert!(!group_chat_summary.is_public);
            } else {
                assert!(false);
            }
        }
        response => panic!("user::initial_state returned an error: {:?}", response),
    }

    futures::future::join3(
        ensure_user_canister_links_to_group(&user1_agent, user1_id, chat_id),
        ensure_user_canister_links_to_group(&user2_agent, user2_id, chat_id),
        ensure_user_canister_links_to_group(&user3_agent, user3_id, chat_id),
    )
    .await;
}

async fn ensure_user_canister_links_to_group(agent: &Agent, user_id: UserId, chat_id: ChatId) {
    let args = user_canister::initial_state::Args {};
    match user_canister_client::initial_state(agent, &user_id.into(), &args)
        .await
        .unwrap()
    {
        user_canister::initial_state::Response::Success(r) => {
            assert_eq!(r.chats.len(), 1);
            if let ChatSummary::Group(g) = r.chats.first().unwrap() {
                assert_eq!(g.chat_id, chat_id);
            } else {
                panic!("Group chat not found");
            }
        }
        response => panic!("InitialState returned an error: {:?}", response),
    };
}
