use crate::rng::random_string;
use crate::setup::{return_env, setup_env, TestEnv};
use crate::utils::assert_json_eq;
use crate::{client, rng};
use group_canister::events::SuccessResult;
use serde_bytes::ByteBuf;
use types::{
    Avatar, ChatEvent, EventIndex, GroupCanisterGroupChatSummary, GroupReplyContext, MessageContentInitial, OptionUpdate, Role,
    TextContent,
};

#[test]
fn reinstall_group_succeeds() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
    let group_name = random_string();
    let group_id = client::user::happy_path::create_group(&mut env, &user, &group_name, false, true);

    client::group::update_group_v2(
        &mut env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            avatar: OptionUpdate::SetToSome(Avatar {
                id: 123,
                mime_type: "abc".to_string(),
                data: ByteBuf::from(vec![1u8; 128]),
            }),
            ..Default::default()
        },
    );

    for i in 0..20 {
        let new_user = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
        client::group::happy_path::add_participants(&mut env, &user, group_id, vec![new_user.user_id]);

        client::group::happy_path::send_text_message(&mut env, &new_user, group_id, i, None);
        client::group::send_message_v2(
            &mut env,
            new_user.principal,
            group_id.into(),
            &group_canister::send_message_v2::Args {
                thread_root_message_index: Some(i.into()),
                message_id: rng::random_message_id(),
                content: MessageContentInitial::Text(TextContent { text: i.to_string() }),
                sender_name: new_user.username(),
                replies_to: ((i % 2) == 0).then_some(GroupReplyContext { event_index: 1.into() }),
                mentioned: Vec::new(),
                forwarding: (i % 3) == 0,
                correlation_id: i.into(),
            },
        );

        if (i % 3) == 0 {
            client::group::change_role(
                &mut env,
                user.principal,
                group_id.into(),
                &group_canister::change_role::Args {
                    user_id: new_user.user_id,
                    new_role: Role::Admin,
                    correlation_id: 0,
                },
            );
        }

        if (i % 5) == 0 {
            client::group::block_user(
                &mut env,
                user.principal,
                group_id.into(),
                &group_canister::block_user::Args {
                    user_id: new_user.user_id,
                    correlation_id: 0,
                },
            );

            if (i % 2) == 0 {
                client::group::unblock_user(
                    &mut env,
                    user.principal,
                    group_id.into(),
                    &group_canister::unblock_user::Args {
                        user_id: new_user.user_id,
                        correlation_id: 0,
                    },
                );
            }
        }

        if (i % 7) == 0 {
            client::group::pin_message_v2(
                &mut env,
                user.principal,
                group_id.into(),
                &group_canister::pin_message_v2::Args {
                    message_index: i.into(),
                    correlation_id: 0,
                },
            );

            if (i % 2) == 0 {
                client::group::unpin_message(
                    &mut env,
                    user.principal,
                    group_id.into(),
                    &group_canister::unpin_message::Args {
                        message_index: i.into(),
                        correlation_id: 0,
                    },
                );
            }
        }
    }

    let events_before = match client::group::events(
        &env,
        user.principal,
        group_id.into(),
        &group_canister::events::Args {
            thread_root_message_index: None,
            start_index: EventIndex::default(),
            ascending: true,
            max_messages: 2000,
            max_events: 2000,
            invite_code: None,
            latest_client_event_index: None,
        },
    ) {
        group_canister::events::Response::Success(r) => r,
        response => panic!("Unexpected response from `events`: {response:?}"),
    };

    let summary_before = client::group::happy_path::summary(&env, &user, group_id);
    let details_before = client::group::happy_path::selected_initial(&env, &user, group_id);

    let result = client::group_index::reinstall_group(
        &mut env,
        controller,
        canister_ids.group_index,
        &group_index_canister::reinstall_group::Args { group_id },
    );
    assert!(
        matches!(result, group_index_canister::reinstall_group::Response::Success),
        "{result:?}"
    );

    let events_after = match client::group::events(
        &env,
        user.principal,
        group_id.into(),
        &group_canister::events::Args {
            thread_root_message_index: None,
            start_index: EventIndex::default(),
            ascending: true,
            max_messages: 1000,
            max_events: 1000,
            invite_code: None,
            latest_client_event_index: None,
        },
    ) {
        group_canister::events::Response::Success(r) => r,
        response => panic!("Unexpected response from `events`: {response:?}"),
    };

    let summary_after = client::group::happy_path::summary(&env, &user, group_id);
    let details_after = client::group::happy_path::selected_initial(&env, &user, group_id);

    validate_events(events_before, events_after);
    validate_summaries(summary_before, summary_after);
    validate_details(details_before, details_after);

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

fn validate_events(before: SuccessResult, after: SuccessResult) {
    assert_eq!(u32::from(before.latest_event_index) + 5, u32::from(after.latest_event_index));
    let index = usize::from(before.latest_event_index) + 1;
    assert!(matches!(after.events[index].event, ChatEvent::ParticipantJoined(_)));
    assert!(matches!(after.events[index + 1].event, ChatEvent::Message(_)));
    assert!(matches!(after.events[index + 2].event, ChatEvent::ChatFrozen(_)));
    assert!(matches!(after.events[index + 3].event, ChatEvent::ChatUnfrozen(_)));
    assert!(matches!(after.events[index + 4].event, ChatEvent::ParticipantLeft(_)));

    for (b, a) in before.events.into_iter().zip(after.events) {
        assert_eq!(format!("{b:?}"), format!("{a:?}"));
    }
}

fn validate_summaries(before: GroupCanisterGroupChatSummary, after: GroupCanisterGroupChatSummary) {
    assert_eq!(before.chat_id, after.chat_id);
    assert_eq!(before.name, after.name);
    assert_eq!(before.description, after.description);
    assert_json_eq(before.subtype, after.subtype);
    assert_eq!(before.avatar_id, after.avatar_id);
    assert_eq!(before.is_public, after.is_public);
    assert_eq!(before.history_visible_to_new_joiners, after.history_visible_to_new_joiners);
    assert_eq!(before.min_visible_event_index, after.min_visible_event_index);
    assert_eq!(before.min_visible_message_index, after.min_visible_message_index);
    assert_eq!(before.joined, after.joined);
    assert_eq!(before.participant_count, after.participant_count);
    assert_eq!(before.role, after.role);
    assert_eq!(before.owner_id, after.owner_id);
    assert_json_eq(before.permissions, after.permissions);
    assert_json_eq(before.my_metrics, after.my_metrics);
    assert_json_eq(before.latest_threads, after.latest_threads);
    assert_json_eq(before.frozen, after.frozen);
    assert_eq!(before.date_last_pinned, after.date_last_pinned);
    assert_eq!(before.events_ttl, after.events_ttl);
    assert_json_eq(before.expired_messages, after.expired_messages);
    assert_eq!(before.next_message_expiry, after.next_message_expiry);
}

fn validate_details(
    before: group_canister::selected_initial::SuccessResult,
    after: group_canister::selected_initial::SuccessResult,
) {
    assert_json_eq(before.participants, after.participants);
    assert_eq!(before.blocked_users, after.blocked_users);
    assert_eq!(before.pinned_messages, after.pinned_messages);
    assert_json_eq(before.rules, after.rules);
}
