use canister_client::operations::{create_group, register_3_default_users, send_direct_message, send_group_message};
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::{CanisterIds, TestIdentity, USER1_DEFAULT_NAME, USER2_DEFAULT_NAME, USER3_DEFAULT_NAME};
use clap::Parser;
use ic_agent::Agent;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use types::{CanisterId, ChatId, GroupRules, MessageContent, TextContent, UserId};
use utils::rand::get_random_item;

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let canister_ids = CanisterIds {
        user_index: opts.user_index,
        group_index: opts.group_index,
        notifications: opts.notifications,
        online_users_aggregator: opts.online_users_aggregator,
        callback: opts.callback,
        proposals_bot: opts.proposals_bot,
        open_storage_index: opts.open_storage_index,
        ledger: opts.ledger,
    };

    run_data_generator(opts.url, canister_ids, opts.username, opts.seed, opts.max_groups).await;
}

async fn run_data_generator(
    url: String,
    canister_ids: CanisterIds,
    username: String,
    seed: Option<u32>,
    max_groups: Option<u32>,
) {
    let other_users = register_test_users(url, canister_ids.user_index).await;
    let target_user =
        wait_for_target_user_to_be_registered(&other_users.first().unwrap().0, username, canister_ids.user_index).await;
    let mut all_user_ids: Vec<_> = other_users.iter().map(|(_, u, _)| u).cloned().collect();
    all_user_ids.push(target_user);

    let mut actions: Vec<_> = other_users
        .iter()
        .map(|(a, u, n)| Action::SendDirectMessage(a.clone(), *u, n.clone()))
        .collect();

    let max_groups = max_groups.unwrap_or(10);
    if max_groups > 0 {
        actions.append(
            &mut other_users
                .iter()
                .map(|(a, u, _)| Action::CreateGroup(a.clone(), *u))
                .collect(),
        );
    }

    let mut rng = build_rng(seed);
    let mut groups_created = 0;

    loop {
        match get_next_action(&actions, rng.next_u32()) {
            Action::SendDirectMessage(a, u, n) => {
                let args = user_canister::send_message::Args {
                    message_id: (rng.next_u64() as u128).into(),
                    thread_root_message_index: None,
                    recipient: target_user,
                    sender_name: n,
                    content: MessageContent::Text(build_text_content(&mut rng)),
                    replies_to: None,
                    forwarding: false,
                    correlation_id: 0,
                };
                send_direct_message(&a, u, &args).await;
            }
            Action::SendGroupMessage(a, g, n) => {
                let args = group_canister::send_message::Args {
                    message_id: (rng.next_u64() as u128).into(),
                    thread_root_message_index: None,
                    sender_name: n,
                    content: MessageContent::Text(build_text_content(&mut rng)),
                    replies_to: None,
                    mentioned: Vec::new(),
                    forwarding: false,
                    correlation_id: 0,
                };
                send_group_message(&a, g, &args).await;
            }
            Action::CreateGroup(a, u) => {
                let args = user_canister::create_group::Args {
                    is_public: rng.next_u32() % 2 == 0,
                    name: lipsum::lipsum_words_from_seed(2, rng.next_u64()),
                    description: lipsum::lipsum_words_from_seed(15, rng.next_u64()),
                    rules: GroupRules::default(),
                    subtype: None,
                    history_visible_to_new_joiners: false,
                    avatar: None,
                    permissions: None,
                };
                let participants = all_user_ids.iter().filter(|&id| *id != u).cloned().collect();
                let chat_id = create_group(&a, u, &args, participants).await;
                groups_created += 1;
                actions.append(
                    &mut other_users
                        .iter()
                        .map(|(a, _, n)| Action::SendGroupMessage(a.clone(), chat_id, n.clone()))
                        .collect(),
                );

                if groups_created == max_groups {
                    actions.retain(|a| !matches!(a, Action::CreateGroup(_, _)));
                }
            }
        }
    }
}

fn build_text_content(rng: &mut StdRng) -> TextContent {
    let length = rng.next_u32() % 20;

    TextContent {
        text: lipsum::lipsum_words_from_seed(length as usize, rng.next_u64()),
    }
}

fn get_next_action(actions: &[Action], random: u32) -> Action {
    get_random_item(actions, random as usize).unwrap().clone()
}

async fn wait_for_target_user_to_be_registered(agent: &Agent, username: String, user_index_canister_id: CanisterId) -> UserId {
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    loop {
        if let Some(user) =
            canister_client::operations::get_user(agent, None, Some(username.clone()), user_index_canister_id).await
        {
            return user.user_id;
        }
        interval.tick().await;
    }
}

async fn register_test_users(url: String, user_index_canister_id: CanisterId) -> Vec<(Agent, UserId, String)> {
    let (user1, user2, user3) = register_3_default_users(url.clone(), user_index_canister_id).await;

    let (user1_agent, user2_agent, user3_agent) = futures::future::join3(
        build_ic_agent(url.clone(), build_identity(TestIdentity::User1)),
        build_ic_agent(url.clone(), build_identity(TestIdentity::User2)),
        build_ic_agent(url.clone(), build_identity(TestIdentity::User3)),
    )
    .await;

    vec![
        (user1_agent, user1, USER1_DEFAULT_NAME.to_string()),
        (user2_agent, user2, USER2_DEFAULT_NAME.to_string()),
        (user3_agent, user3, USER3_DEFAULT_NAME.to_string()),
    ]
}

fn build_rng(seed: Option<u32>) -> StdRng {
    let seed = if let Some(s) = seed {
        s as u64
    } else {
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
    };

    let mut seed_bytes = [0u8; 32];
    seed_bytes[..16].copy_from_slice(&seed.to_be_bytes());
    StdRng::from_seed(seed_bytes)
}

#[derive(Parser)]
struct Opts {
    pub url: String,
    pub root: CanisterId,
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications: CanisterId,
    pub online_users_aggregator: CanisterId,
    pub callback: CanisterId,
    pub proposals_bot: CanisterId,
    pub open_storage_index: CanisterId,
    pub ledger: CanisterId,
    pub username: String,
    pub seed: Option<u32>,
    pub max_groups: Option<u32>,
}

#[derive(Clone)]
enum Action {
    SendDirectMessage(Agent, UserId, String),
    SendGroupMessage(Agent, ChatId, String),
    CreateGroup(Agent, UserId),
}
