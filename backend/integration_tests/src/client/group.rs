use crate::{generate_query_call, generate_update_call};
use group_canister::*;

// Queries
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(events_range);
generate_query_call!(selected_initial);
generate_query_call!(selected_updates);

// Updates
generate_update_call!(add_participants);
generate_update_call!(add_reaction);
generate_update_call!(block_user);
generate_update_call!(change_role);
generate_update_call!(delete_messages);
generate_update_call!(edit_message);
generate_update_call!(pin_message);
generate_update_call!(register_poll_vote);
generate_update_call!(remove_participant);
generate_update_call!(remove_reaction);
generate_update_call!(send_message);
generate_update_call!(unpin_message);

pub mod happy_path {
    use crate::rng::random_message_id;
    use crate::User;
    use ic_state_machine_tests::StateMachine;
    use types::{ChatId, MessageContent, TextContent, UserId};

    pub fn add_participants(env: &mut StateMachine, sender: &User, group_chat_id: ChatId, user_ids: Vec<UserId>) {
        let response = super::add_participants(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::add_participants::Args {
                user_ids,
                added_by_name: sender.username(),
                allow_blocked_users: false,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::add_participants::Response::Success => {}
            response => panic!("'add_participants' error: {:?}", response),
        }
    }

    pub fn send_text_message(
        env: &mut StateMachine,
        sender: &User,
        group_chat_id: ChatId,
        text: impl ToString,
    ) -> group_canister::send_message::SuccessResult {
        let response = super::send_message(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::send_message::Args {
                thread_root_message_index: None,
                message_id: random_message_id(),
                content: MessageContent::Text(TextContent { text: text.to_string() }),
                sender_name: sender.username(),
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::send_message::Response::Success(result) => result,
            response => panic!("'send_message' error: {:?}", response),
        }
    }
}
