use crate::{generate_query_call, generate_update_call};
use user_canister::*;

// Queries
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(initial_state_v2);
generate_query_call!(updates_v2);

// Updates
generate_update_call!(add_reaction);
generate_update_call!(block_user);
generate_update_call!(delete_group);
generate_update_call!(delete_messages);
generate_update_call!(edit_message_v2);
generate_update_call!(cancel_message_reminder);
generate_update_call!(create_group);
generate_update_call!(leave_group);
generate_update_call!(mark_read_v2);
generate_update_call!(mute_notifications);
generate_update_call!(remove_reaction);
generate_update_call!(send_message_v2);
generate_update_call!(set_message_reminder);
generate_update_call!(unblock_user);
generate_update_call!(undelete_messages);

pub mod happy_path {
    use crate::rng::random_message_id;
    use crate::User;
    use ic_test_state_machine_client::StateMachine;
    use types::{ChatId, EventIndex, EventsResponse, GroupRules, MessageContentInitial, MessageId, TextContent, UserId};

    pub fn send_text_message(
        env: &mut StateMachine,
        sender: &User,
        recipient: UserId,
        text: impl ToString,
        message_id: Option<MessageId>,
    ) -> user_canister::send_message_v2::SuccessResult {
        let response = super::send_message_v2(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::send_message_v2::Args {
                recipient,
                thread_root_message_index: None,
                message_id: message_id.unwrap_or_else(random_message_id),
                sender_name: sender.username(),
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                replies_to: None,
                forwarding: false,
                correlation_id: 0,
            },
        );

        match response {
            user_canister::send_message::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn create_group(
        env: &mut StateMachine,
        sender: &User,
        name: &str,
        is_public: bool,
        history_visible_to_new_joiners: bool,
    ) -> ChatId {
        let response = super::create_group(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::create_group::Args {
                is_public,
                name: name.to_string(),
                description: format!("{name}_description"),
                avatar: None,
                history_visible_to_new_joiners,
                permissions: None,
                rules: GroupRules::default(),
                subtype: None,
                events_ttl: None,
                gate: None,
            },
        );

        match response {
            user_canister::create_group::Response::Success(result) => result.chat_id,
            response => panic!("'create_group' error: {response:?}"),
        }
    }

    pub fn initial_state_v2(env: &StateMachine, sender: &User) -> user_canister::initial_state_v2::SuccessResult {
        let response = super::initial_state_v2(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::initial_state_v2::Args { disable_cache: None },
        );

        match response {
            user_canister::initial_state_v2::Response::Success(result) => result,
            response => panic!("'initial_state_v2' error: {response:?}"),
        }
    }

    pub fn events(
        env: &StateMachine,
        sender: &User,
        user_id: UserId,
        start_index: EventIndex,
        ascending: bool,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResponse {
        let response = super::events(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::events::Args {
                user_id,
                thread_root_message_index: None,
                start_index,
                ascending,
                max_messages,
                max_events,
                latest_client_event_index: None,
            },
        );

        match response {
            user_canister::events::Response::Success(result) => result,
            response => panic!("'events' error: {response:?}"),
        }
    }

    pub fn events_by_index(env: &StateMachine, sender: &User, user_id: UserId, events: Vec<EventIndex>) -> EventsResponse {
        let response = super::events_by_index(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::events_by_index::Args {
                user_id,
                thread_root_message_index: None,
                events,
                latest_client_event_index: None,
            },
        );

        match response {
            user_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }
}
