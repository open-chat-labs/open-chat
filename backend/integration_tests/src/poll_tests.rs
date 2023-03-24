use crate::env::ENV;
use crate::rng::random_message_id;
use crate::{client, TestEnv, User};
use ic_test_state_machine_client::StateMachine;
use itertools::Itertools;
use std::collections::HashMap;
use std::ops::Deref;
use std::time::{Duration, SystemTime};
use types::{
    CanisterId, ChatEvent, ChatId, MessageContent, MessageContentInitial, PollConfig, PollContent, PollVotes, TotalVotes,
};

#[test]
fn allow_multiple_votes_per_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let poll_config = PollConfig {
        text: None,
        options: vec!["1".to_string(), "2".to_string()],
        end_date: None,
        anonymous: false,
        show_votes_before_end_date: false,
        allow_multiple_votes_per_user: true,
    };

    let TestData {
        user1: _,
        user2,
        group,
        create_poll_result,
    } = init_test_data(env, canister_ids.user_index, poll_config);

    if let group_canister::send_message::Response::Success(r) = create_poll_result {
        let register_vote_result1 = client::group::happy_path::register_poll_vote(env, &user2, group, r.message_index, 0);
        assert_eq!(register_vote_result1.user, vec![0]);

        let register_vote_result2 = client::group::happy_path::register_poll_vote(env, &user2, group, r.message_index, 1);
        assert_eq!(register_vote_result2.user.into_iter().sorted().collect_vec(), vec![0, 1]);
    }
}

#[test]
fn single_vote_per_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let poll_config = PollConfig {
        text: None,
        options: vec!["1".to_string(), "2".to_string()],
        end_date: None,
        anonymous: false,
        show_votes_before_end_date: false,
        allow_multiple_votes_per_user: false,
    };

    let TestData {
        user1: _,
        user2,
        group,
        create_poll_result,
    } = init_test_data(env, canister_ids.user_index, poll_config);

    if let group_canister::send_message::Response::Success(r) = create_poll_result {
        let register_vote_result1 = client::group::happy_path::register_poll_vote(env, &user2, group, r.message_index, 0);
        assert_eq!(register_vote_result1.user, vec![0]);

        let register_vote_result2 = client::group::happy_path::register_poll_vote(env, &user2, group, r.message_index, 1);
        assert_eq!(register_vote_result2.user.into_iter().sorted().collect_vec(), vec![1]);
    }
}

#[test]
fn polls_ended_correctly() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let current_time = env.time().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_millis() as u64;

    let poll_config1 = PollConfig {
        text: None,
        options: vec!["1".to_string(), "2".to_string()],
        end_date: Some(current_time + 1000), // in 1 second
        anonymous: false,
        show_votes_before_end_date: false,
        allow_multiple_votes_per_user: false,
    };

    let TestData {
        user1,
        user2,
        group,
        create_poll_result: create_poll_result1,
    } = init_test_data(env, canister_ids.user_index, poll_config1);

    let poll_config2 = PollConfig {
        text: None,
        options: vec!["1".to_string(), "2".to_string()],
        end_date: Some(current_time + 2000), // in 2 seconds
        anonymous: false,
        show_votes_before_end_date: false,
        allow_multiple_votes_per_user: false,
    };

    let create_poll_result2 = client::group::send_message_v2(
        env,
        user1.principal,
        group.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_message_id(),
            content: MessageContentInitial::Poll(PollContent {
                config: poll_config2,
                votes: PollVotes {
                    total: TotalVotes::Anonymous(HashMap::default()),
                    user: Vec::new(),
                },
                ended: false,
            }),
            sender_name: user1.username(),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            correlation_id: 0,
        },
    );

    if let group_canister::send_message::Response::Success(r) = create_poll_result1 {
        let register_vote_result1 = client::group::happy_path::register_poll_vote(env, &user2, group, r.message_index, 0);
        assert!(matches!(register_vote_result1.total, TotalVotes::Hidden(1)));

        env.advance_time(Duration::from_millis(999));
        env.tick();

        let event = client::group::happy_path::events_by_index(env, &user1, group, vec![r.event_index])
            .events
            .pop()
            .unwrap();

        if let ChatEvent::Message(m) = event.event {
            if let MessageContent::Poll(p) = m.content {
                assert!(!p.ended);
                assert!(matches!(p.votes.total, TotalVotes::Hidden(_)));
            } else {
                unreachable!()
            }
        } else {
            unreachable!()
        }

        env.advance_time(Duration::from_millis(1));
        env.tick();

        let event = client::group::happy_path::events_by_index(env, &user1, group, vec![r.event_index])
            .events
            .pop()
            .unwrap();

        if let ChatEvent::Message(m) = event.event {
            if let MessageContent::Poll(p) = m.content {
                assert!(p.ended);
                assert!(matches!(p.votes.total, TotalVotes::Visible(_)));
            } else {
                unreachable!()
            }
        } else {
            unreachable!()
        }
    }

    if let group_canister::send_message::Response::Success(r) = create_poll_result2 {
        let register_vote_result2 = client::group::happy_path::register_poll_vote(env, &user2, group, r.message_index, 0);
        assert!(matches!(register_vote_result2.total, TotalVotes::Hidden(1)));

        env.advance_time(Duration::from_millis(999));
        env.tick();

        let event = client::group::happy_path::events_by_index(env, &user1, group, vec![r.event_index])
            .events
            .pop()
            .unwrap();

        if let ChatEvent::Message(m) = event.event {
            if let MessageContent::Poll(p) = m.content {
                assert!(!p.ended);
                assert!(matches!(p.votes.total, TotalVotes::Hidden(_)));
            } else {
                unreachable!()
            }
        } else {
            unreachable!()
        }

        env.advance_time(Duration::from_millis(1));
        env.tick();

        let event = client::group::happy_path::events_by_index(env, &user1, group, vec![r.event_index])
            .events
            .pop()
            .unwrap();

        if let ChatEvent::Message(m) = event.event {
            if let MessageContent::Poll(p) = m.content {
                assert!(p.ended);
                assert!(matches!(p.votes.total, TotalVotes::Visible(_)));
            } else {
                unreachable!()
            }
        } else {
            unreachable!()
        }
    }
}

fn init_test_data(env: &mut StateMachine, user_index: CanisterId, poll_config: PollConfig) -> TestData {
    let user1 = client::user_index::happy_path::register_user(env, user_index);
    let user2 = client::user_index::happy_path::register_user(env, user_index);

    let group = client::user::happy_path::create_group(env, &user1, "TEST_NAME", false, false);
    client::group::happy_path::add_participants(env, &user1, group, vec![user2.user_id]);

    let create_poll_result = client::group::send_message_v2(
        env,
        user1.principal,
        group.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_message_id(),
            content: MessageContentInitial::Poll(PollContent {
                config: poll_config,
                votes: PollVotes {
                    total: TotalVotes::Anonymous(HashMap::default()),
                    user: Vec::new(),
                },
                ended: false,
            }),
            sender_name: user1.username(),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            correlation_id: 0,
        },
    );

    TestData {
        user1,
        user2,
        group,
        create_poll_result,
    }
}

struct TestData {
    user1: User,
    user2: User,
    group: ChatId,
    create_poll_result: group_canister::send_message::Response,
}
