use crate::block_on;
use canister_client::canisters;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_agent::Agent;
use ic_fondue::ic_manager::IcHandle;
use types::{ChatSummary, ChatId, UserId};

pub fn create_group_test(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(create_group_test_impl(handle, ctx));
}

async fn create_group_test_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();

    let canister_ids = create_and_install_service_canisters(url.clone()).await;

    let (user1_id, user2_id, user3_id) = futures::future::join3(
        register_user(
            url.clone(),
            TestIdentity::User1,
            Some("Andy".to_string()),
            canister_ids.user_index,
        ),
        register_user(
            url.clone(),
            TestIdentity::User2,
            Some("Bob".to_string()),
            canister_ids.user_index,
        ),
        register_user(
            url.clone(),
            TestIdentity::User3,
            Some("Charlie".to_string()),
            canister_ids.user_index,
        ),
    )
    .await;

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
        history_visible_to_new_joiners: false,
    };

    let chat_id = create_group(&user1_agent, user1_id, &args, vec![user2_id, user3_id]).await;

    match canisters::group::summary(&user1_agent, &chat_id.into(), &group_canister::summary::Args {}).await {
        group_canister::summary::Response::Success(r) => {
            assert_eq!(r.summary.chat_id, chat_id);
            assert_eq!(r.summary.name, name);
            assert_eq!(r.summary.description, description);
            assert!(!r.summary.is_public);
            assert_eq!(r.summary.participants.len(), 3);
        }
        response => panic!("Summary returned an error: {:?}", response),
    }

    futures::future::join3(
        ensure_user_canister_links_to_group(&user1_agent, user1_id, chat_id),
        ensure_user_canister_links_to_group(&user2_agent, user2_id, chat_id),
        ensure_user_canister_links_to_group(&user3_agent, user3_id, chat_id),
    )
    .await;
}

async fn ensure_user_canister_links_to_group(agent: &Agent, user_id: UserId, chat_id: ChatId) {
    let args = user_canister::updates::Args { updates_since: None };
    match canisters::user::updates(agent, &user_id.into(), &args).await {
        user_canister::updates::Response::Success(r) => {
            assert_eq!(r.chats_added.len(), 1);
            if let ChatSummary::Group(g) = r.chats_added.first().unwrap() {
                assert_eq!(g.chat_id, chat_id);
            } else {
                panic!("Group chat not found");
            }
        }
        response => panic!("Updates returned an error: {:?}", response),
    };
}
