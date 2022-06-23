use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;
use itertools::Itertools;
use std::collections::HashMap;
use std::panic;
use types::{ChatEvent, MessageContent, PollConfig, PollContent, PollVotes, TotalVotes, VoteOperation};

pub fn poll_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(poll_tests_impl(handle, ctx));
}

async fn poll_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, user2_id) = register_2_default_users(url.clone(), canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user2_identity = build_identity(TestIdentity::User2);

    let (user1_agent, user2_agent) = futures::future::join(
        build_ic_agent(url.clone(), user1_identity),
        build_ic_agent(url.clone(), user2_identity),
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

    let chat_id = create_group(&user1_agent, user1_id, &args, vec![user2_id]).await;

    print!("1. Create a poll... ");
    let send_message_args1 = group_canister::send_message::Args {
        message_id: 1.into(),
        sender_name: "TEST!".to_string(),
        content: MessageContent::Poll(PollContent {
            config: PollConfig {
                text: None,
                options: vec!["abc".to_string(), "xyz".to_string()],
                end_date: None,
                anonymous: false,
                show_votes_before_end_date: false,
                allow_multiple_votes_per_user: false,
            },
            votes: PollVotes {
                total: TotalVotes::Visible(HashMap::new()),
                user: Vec::new(),
            },
            ended: false,
        }),
        replies_to: None,
        mentioned: Vec::new(),
    };
    let _ = send_group_message(&user1_agent, chat_id, &send_message_args1).await;
    println!("Ok");

    print!("2. Register a vote... ");
    let register_poll_vote_args = group_canister::register_poll_vote::Args {
        message_index: 0.into(),
        poll_option: 0,
        operation: VoteOperation::RegisterVote,
    };
    match group_canister_client::register_poll_vote(&user1_agent, &chat_id.into(), &register_poll_vote_args)
        .await
        .unwrap()
    {
        group_canister::register_poll_vote::Response::Success(votes) => match votes.total {
            TotalVotes::Visible(total) => {
                assert_eq!(total.values().filter(|v| !v.is_empty()).count(), 1);
                assert_eq!(total[&0], vec![user1_id]);
            }
            total => panic!("Unexpected 'total_votes' response: {total:?}"),
        },
        response => panic!("events_range returned an error: {response:?}"),
    };
    println!("Ok");

    print!("3. Register a vote from user2... ");
    match group_canister_client::register_poll_vote(&user2_agent, &chat_id.into(), &register_poll_vote_args)
        .await
        .unwrap()
    {
        group_canister::register_poll_vote::Response::Success(votes) => match votes.total {
            TotalVotes::Visible(total) => {
                assert_eq!(total.values().filter(|v| !v.is_empty()).count(), 1);
                assert_eq!(total[&0].iter().copied().sorted().collect_vec(), vec![user1_id, user2_id]);
            }
            total => panic!("Unexpected 'total_votes' response: {total:?}"),
        },
        response => panic!("events_range returned an error: {response:?}"),
    };
    println!("Ok");

    print!("4. Register a vote for a different option... ");
    let register_poll_vote_args = group_canister::register_poll_vote::Args {
        message_index: 0.into(),
        poll_option: 1,
        operation: VoteOperation::RegisterVote,
    };
    match group_canister_client::register_poll_vote(&user1_agent, &chat_id.into(), &register_poll_vote_args)
        .await
        .unwrap()
    {
        group_canister::register_poll_vote::Response::Success(votes) => match votes.total {
            TotalVotes::Visible(total) => {
                assert_eq!(total.values().filter(|v| !v.is_empty()).count(), 2);
                assert_eq!(total[&0], vec![user2_id]);
                assert_eq!(total[&1], vec![user1_id]);
            }
            total => panic!("Unexpected 'total_votes' response: {total:?}"),
        },
        response => panic!("events_range returned an error: {response:?}"),
    };
    println!("Ok");

    print!("5. Delete a vote... ");
    let register_poll_vote_args = group_canister::register_poll_vote::Args {
        message_index: 0.into(),
        poll_option: 1,
        operation: VoteOperation::DeleteVote,
    };
    match group_canister_client::register_poll_vote(&user1_agent, &chat_id.into(), &register_poll_vote_args)
        .await
        .unwrap()
    {
        group_canister::register_poll_vote::Response::Success(votes) => match votes.total {
            TotalVotes::Visible(total) => {
                assert_eq!(total.values().filter(|v| !v.is_empty()).count(), 1);
                assert_eq!(total[&0], vec![user2_id]);
            }
            total => panic!("Unexpected 'total_votes' response: {total:?}"),
        },
        response => panic!("events_range returned an error: {response:?}"),
    };
    println!("Ok");

    print!("6. Check the events were recorded correctly... ");
    let events_range_args = group_canister::events_range::Args {
        from_index: 0.into(),
        to_index: 10.into(),
    };
    match group_canister_client::events_range(&user1_agent, &chat_id.into(), &events_range_args)
        .await
        .unwrap()
    {
        group_canister::events_range::Response::Success(r) => {
            assert_eq!(r.events.len(), 7);
            assert!(matches!(r.events[0].event, ChatEvent::GroupChatCreated(_)));
            assert!(matches!(r.events[1].event, ChatEvent::ParticipantsAdded(_)));
            assert!(matches!(r.events[2].event, ChatEvent::Message(_)));
            assert!(matches!(r.events[3].event, ChatEvent::PollVoteRegistered(_)));
            assert!(matches!(r.events[4].event, ChatEvent::PollVoteRegistered(_)));
            assert!(matches!(r.events[5].event, ChatEvent::PollVoteRegistered(_)));
            assert!(matches!(r.events[6].event, ChatEvent::PollVoteDeleted(_)));
        }
        response => panic!("events_range returned an error: {response:?}"),
    };
    println!("Ok");
}
