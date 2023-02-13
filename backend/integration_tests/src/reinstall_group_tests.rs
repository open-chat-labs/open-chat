use crate::rng::random_string;
use crate::setup::{return_env, setup_env, TestEnv};
use crate::{client, rng};
use types::{ChatEvent, EventIndex, MessageContentInitial, TextContent};

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

    for i in 0..10 {
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
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                correlation_id: i.into(),
            },
        );
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

    assert_eq!(
        u32::from(events_before.latest_event_index) + 5,
        u32::from(events_after.latest_event_index)
    );
    let index = usize::from(events_before.latest_event_index) + 1;
    assert!(matches!(events_after.events[index].event, ChatEvent::ParticipantJoined(_)));
    assert!(matches!(events_after.events[index + 1].event, ChatEvent::Message(_)));
    assert!(matches!(events_after.events[index + 2].event, ChatEvent::ChatFrozen(_)));
    assert!(matches!(events_after.events[index + 3].event, ChatEvent::ChatUnfrozen(_)));
    assert!(matches!(events_after.events[index + 4].event, ChatEvent::ParticipantLeft(_)));

    for (l, r) in events_before.events.into_iter().zip(events_after.events) {
        assert_eq!(format!("{l:?}"), format!("{r:?}"));
    }

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}
