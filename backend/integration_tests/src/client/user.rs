use crate::{generate_query_call, generate_update_call};
use user_canister::*;

// Queries
generate_query_call!(events_by_index);
generate_query_call!(events_range);
generate_query_call!(initial_state);
generate_query_call!(updates);

// Updates
generate_update_call!(add_reaction);
generate_update_call!(assume_group_super_admin);
generate_update_call!(block_user);
generate_update_call!(delete_messages);
generate_update_call!(edit_message);
generate_update_call!(create_group);
generate_update_call!(leave_group);
generate_update_call!(join_group_v2);
generate_update_call!(mark_read_v2);
generate_update_call!(mute_notifications);
generate_update_call!(relinquish_group_super_admin);
generate_update_call!(remove_reaction);
generate_update_call!(send_message);
generate_update_call!(unblock_user);
generate_update_call!(undelete_messages);

pub mod happy_path {
    use crate::rng::random_message_id;
    use crate::User;
    use ic_state_machine_tests::StateMachine;
    use types::{ChatId, EventIndex, GroupRules, MessageContent, MessageId, TextContent, UserId};

    pub fn send_text_message(
        env: &mut StateMachine,
        sender: &User,
        recipient: UserId,
        text: impl ToString,
        message_id: Option<MessageId>,
    ) -> user_canister::send_message::SuccessResult {
        let response = super::send_message(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::send_message::Args {
                recipient,
                thread_root_message_index: None,
                message_id: message_id.unwrap_or_else(|| random_message_id()),
                sender_name: sender.username(),
                content: MessageContent::Text(TextContent { text: text.to_string() }),
                replies_to: None,
                forwarding: false,
                correlation_id: 0,
            },
        );

        match response {
            user_canister::send_message::Response::Success(result) => result,
            response => panic!("'send_message' error: {:?}", response),
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
            },
        );

        match response {
            user_canister::create_group::Response::Success(result) => result.chat_id,
            response => panic!("'create_group' error: {:?}", response),
        }
    }

    pub fn initial_state(env: &StateMachine, sender: &User) -> user_canister::initial_state::SuccessResult {
        let response = super::initial_state(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::initial_state::Args { disable_cache: None },
        );

        match response {
            user_canister::initial_state::Response::Success(result) => result,
            response => panic!("'initial_state' error: {:?}", response),
        }
    }

    pub fn events_by_index(
        env: &StateMachine,
        sender: &User,
        user_id: UserId,
        events: Vec<EventIndex>,
    ) -> user_canister::events_by_index::SuccessResult {
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
            response => panic!("'events_by_index' error: {:?}", response),
        }
    }
}
