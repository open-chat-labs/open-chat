use crate::{generate_query_call, generate_update_call};
use community_canister::*;

// Queries
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(selected_initial);
generate_query_call!(selected_updates);
generate_query_call!(summary);

// Updates
generate_update_call!(add_reaction);
generate_update_call!(block_user);
generate_update_call!(change_role);
generate_update_call!(delete_messages);
generate_update_call!(edit_message);
generate_update_call!(enable_invite_code);
generate_update_call!(remove_member);
generate_update_call!(remove_reaction);
generate_update_call!(send_message);
generate_update_call!(unblock_user);
generate_update_call!(undelete_messages);

pub mod happy_path {
    use crate::rng::random_message_id;
    use crate::User;
    use ic_test_state_machine_client::StateMachine;
    use types::{
        ChannelId, CommunityCanisterCommunitySummary, CommunityId, EventIndex, EventsResponse, MessageContentInitial,
        MessageId, MessageIndex, TextContent,
    };

    pub fn send_text_message(
        env: &mut StateMachine,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
        thread_root_message_index: Option<MessageIndex>,
        text: impl ToString,
        message_id: Option<MessageId>,
    ) -> community_canister::send_message::SuccessResult {
        let response = super::send_message(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::send_message::Args {
                channel_id,
                thread_root_message_index,
                message_id: message_id.unwrap_or_else(random_message_id),
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                sender_name: sender.username(),
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
            },
        );

        match response {
            community_canister::send_message::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn events_by_index(
        env: &StateMachine,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
        events: Vec<EventIndex>,
    ) -> EventsResponse {
        let response = super::events_by_index(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::events_by_index::Args {
                channel_id,
                thread_root_message_index: None,
                events,
                latest_client_event_index: None,
            },
        );

        match response {
            community_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }

    pub fn summary(env: &StateMachine, sender: &User, community_id: CommunityId) -> CommunityCanisterCommunitySummary {
        let response = super::summary(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::summary::Args {},
        );

        match response {
            community_canister::summary::Response::Success(result) => result.summary,
            response => panic!("'summary' error: {response:?}"),
        }
    }
}
