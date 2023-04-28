use crate::{generate_query_call, generate_update_call};
use group_canister::*;

// Queries
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(public_summary);
generate_query_call!(selected_initial);
generate_query_call!(selected_updates);
generate_query_call!(summary);
generate_query_call!(summary_updates);

// Updates
generate_update_call!(add_participants);
generate_update_call!(add_reaction);
generate_update_call!(block_user);
generate_update_call!(change_role);
generate_update_call!(delete_messages);
generate_update_call!(edit_message_v2);
generate_update_call!(pin_message_v2);
generate_update_call!(register_poll_vote);
generate_update_call!(remove_participant);
generate_update_call!(remove_reaction);
generate_update_call!(send_message_v2);
generate_update_call!(unblock_user);
generate_update_call!(undelete_messages);
generate_update_call!(unpin_message);
generate_update_call!(update_group_v2);

pub mod happy_path {
    use crate::rng::random_message_id;
    use crate::User;
    use ic_test_state_machine_client::StateMachine;
    use types::{
        ChatId, EventIndex, EventsResponse, GroupCanisterGroupChatSummary, GroupCanisterGroupChatSummaryUpdates,
        MessageContentInitial, MessageId, MessageIndex, PollVotes, TextContent, TimestampMillis, UserId, VoteOperation,
    };

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
            response => panic!("'add_participants' error: {response:?}"),
        }
    }

    pub fn send_text_message(
        env: &mut StateMachine,
        sender: &User,
        group_chat_id: ChatId,
        thread_root_message_index: Option<MessageIndex>,
        text: impl ToString,
        message_id: Option<MessageId>,
    ) -> group_canister::send_message_v2::SuccessResult {
        let response = super::send_message_v2(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::send_message_v2::Args {
                thread_root_message_index,
                message_id: message_id.unwrap_or_else(random_message_id),
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                sender_name: sender.username(),
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::send_message::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn register_poll_vote(
        env: &mut StateMachine,
        sender: &User,
        group_chat_id: ChatId,
        message_index: MessageIndex,
        poll_option: u32,
    ) -> PollVotes {
        let response = super::register_poll_vote(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::register_poll_vote::Args {
                thread_root_message_index: None,
                message_index,
                poll_option,
                operation: VoteOperation::RegisterVote,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::register_poll_vote::Response::Success(result) => result,
            response => panic!("'register_poll_vote' error: {response:?}"),
        }
    }

    pub fn events_by_index(
        env: &StateMachine,
        sender: &User,
        group_chat_id: ChatId,
        events: Vec<EventIndex>,
    ) -> EventsResponse {
        let response = super::events_by_index(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::events_by_index::Args {
                thread_root_message_index: None,
                events,
                latest_client_event_index: None,
            },
        );

        match response {
            group_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }

    pub fn summary(env: &StateMachine, sender: &User, group_chat_id: ChatId) -> GroupCanisterGroupChatSummary {
        let response = super::summary(env, sender.principal, group_chat_id.into(), &group_canister::summary::Args {});

        match response {
            group_canister::summary::Response::Success(result) => result.summary,
            response => panic!("'summary' error: {response:?}"),
        }
    }

    pub fn summary_updates(
        env: &StateMachine,
        sender: &User,
        group_chat_id: ChatId,
        updates_since: TimestampMillis,
    ) -> Option<GroupCanisterGroupChatSummaryUpdates> {
        let response = super::summary_updates(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::summary_updates::Args { updates_since },
        );

        match response {
            group_canister::summary_updates::Response::Success(result) => Some(result.updates),
            group_canister::summary_updates::Response::SuccessNoUpdates => None,
            response => panic!("'summary_updates' error: {response:?}"),
        }
    }
}
