use crate::{generate_msgpack_query_call, generate_msgpack_update_call, generate_update_call};
use group_canister::*;
use ic_stable_structures::memory_manager::MemoryId;

pub const CHAT_EVENTS_MEMORY_ID: MemoryId = MemoryId::new(3);

// Queries
generate_msgpack_query_call!(events);
generate_msgpack_query_call!(events_by_index);
generate_msgpack_query_call!(events_window);
generate_msgpack_query_call!(public_summary);
generate_msgpack_query_call!(selected_initial);
generate_msgpack_query_call!(selected_updates_v2);
generate_msgpack_query_call!(summary);
generate_msgpack_query_call!(summary_updates);

// Updates
generate_msgpack_update_call!(accept_p2p_swap);
generate_msgpack_update_call!(add_reaction);
generate_msgpack_update_call!(block_user);
generate_msgpack_update_call!(cancel_p2p_swap);
generate_msgpack_update_call!(change_role);
generate_msgpack_update_call!(claim_prize);
generate_msgpack_update_call!(convert_into_community);
generate_msgpack_update_call!(delete_messages);
generate_msgpack_update_call!(edit_message_v2);
generate_msgpack_update_call!(enable_invite_code);
generate_update_call!(end_video_call);
generate_msgpack_update_call!(join_video_call);
generate_msgpack_update_call!(pin_message_v2);
generate_msgpack_update_call!(register_poll_vote);
generate_msgpack_update_call!(remove_participant);
generate_msgpack_update_call!(remove_reaction);
generate_msgpack_update_call!(send_message_v2);
generate_update_call!(start_video_call);
generate_msgpack_update_call!(toggle_mute_notifications);
generate_msgpack_update_call!(unblock_user);
generate_msgpack_update_call!(undelete_messages);
generate_msgpack_update_call!(unpin_message);
generate_msgpack_update_call!(update_group_v2);

pub mod happy_path {
    use crate::client::user;
    use crate::env::VIDEO_CALL_OPERATOR;
    use crate::User;
    use candid::Principal;
    use pocket_ic::PocketIc;
    use testing::rng::random_from_u128;
    use types::{
        ChatId, EventIndex, EventsResponse, GroupCanisterGroupChatSummary, GroupCanisterGroupChatSummaryUpdates,
        GroupReplyContext, GroupRole, MessageContentInitial, MessageId, MessageIndex, Milliseconds, PollVotes, Reaction,
        TextContent, TimestampMillis, UserId, VideoCallType, VoteOperation,
    };

    pub fn send_text_message(
        env: &mut PocketIc,
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
                message_id: message_id.unwrap_or_else(random_from_u128),
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                sender_name: sender.username(),
                sender_display_name: None,
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                block_level_markdown: false,
                rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::send_message_v2::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn send_message(
        env: &mut PocketIc,
        sender: &User,
        group_chat_id: ChatId,
        thread_root_message_index: Option<MessageIndex>,
        content: MessageContentInitial,
        replies_to: Option<GroupReplyContext>,
        message_id: Option<MessageId>,
    ) -> group_canister::send_message_v2::SuccessResult {
        let response = super::send_message_v2(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::send_message_v2::Args {
                thread_root_message_index,
                message_id: message_id.unwrap_or_else(random_from_u128),
                content,
                sender_name: sender.username(),
                sender_display_name: None,
                replies_to,
                mentioned: Vec::new(),
                forwarding: false,
                block_level_markdown: false,
                rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::send_message_v2::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn send_message_with_transfer(
        env: &mut PocketIc,
        group_chat_id: ChatId,
        sender: &User,
        content: MessageContentInitial,
        message_id: Option<MessageId>,
    ) -> user_canister::send_message_with_transfer_to_group::SuccessResult {
        let response = user::send_message_with_transfer_to_group(
            env,
            sender.principal,
            sender.user_id.into(),
            &user_canister::send_message_with_transfer_to_group::Args {
                thread_root_message_index: None,
                message_id: message_id.unwrap_or_else(random_from_u128),
                content,
                replies_to: None,
                block_level_markdown: false,
                message_filter_failed: None,
                correlation_id: 0,
                sender_name: sender.username(),
                sender_display_name: None,
                mentioned: Vec::new(),
                rules_accepted: None,
                group_id: group_chat_id,
                pin: None,
            },
        );

        match response {
            user_canister::send_message_with_transfer_to_group::Response::Success(result) => result,
            response => panic!("'send_message_with_transfer_to_group' error: {response:?}"),
        }
    }

    pub fn update_group(
        env: &mut PocketIc,
        sender: Principal,
        group_chat_id: ChatId,
        args: &group_canister::update_group_v2::Args,
    ) {
        let response = super::update_group_v2(env, sender, group_chat_id.into(), args);

        match response {
            group_canister::update_group_v2::Response::SuccessV2(_) => {}
            response => panic!("'update_group_v2' error: {response:?}"),
        }
    }

    pub fn change_role(env: &mut PocketIc, sender: Principal, group_chat_id: ChatId, user_id: UserId, new_role: GroupRole) {
        let response = super::change_role(
            env,
            sender,
            group_chat_id.into(),
            &group_canister::change_role::Args {
                user_id,
                new_role,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::change_role::Response::Success => {}
            response => panic!("'change_role' error: {response:?}"),
        }
    }

    pub fn register_poll_vote(
        env: &mut PocketIc,
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
                new_achievement: false,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::register_poll_vote::Response::Success(result) => result,
            response => panic!("'register_poll_vote' error: {response:?}"),
        }
    }

    pub fn events(
        env: &PocketIc,
        sender: &User,
        group_chat_id: ChatId,
        start_index: EventIndex,
        ascending: bool,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResponse {
        let response = super::events(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::events::Args {
                thread_root_message_index: None,
                start_index,
                ascending,
                max_messages,
                max_events,
                latest_known_update: None,
            },
        );

        match response {
            group_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_window' error: {response:?}"),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn thread_events(
        env: &PocketIc,
        sender: &User,
        group_chat_id: ChatId,
        thread_root_message_index: MessageIndex,
        start_index: EventIndex,
        ascending: bool,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResponse {
        let response = super::events(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::events::Args {
                thread_root_message_index: Some(thread_root_message_index),
                start_index,
                ascending,
                max_messages,
                max_events,
                latest_known_update: None,
            },
        );

        match response {
            group_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_window' error: {response:?}"),
        }
    }

    pub fn events_by_index(env: &PocketIc, sender: &User, group_chat_id: ChatId, events: Vec<EventIndex>) -> EventsResponse {
        let response = super::events_by_index(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::events_by_index::Args {
                thread_root_message_index: None,
                events,
                latest_known_update: None,
            },
        );

        match response {
            group_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }

    pub fn events_window(
        env: &PocketIc,
        sender: &User,
        group_chat_id: ChatId,
        mid_point: MessageIndex,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResponse {
        let response = super::events_window(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::events_window::Args {
                thread_root_message_index: None,
                mid_point,
                max_messages,
                max_events,
                latest_known_update: None,
            },
        );

        match response {
            group_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_window' error: {response:?}"),
        }
    }

    pub fn selected_initial(
        env: &PocketIc,
        sender: &User,
        group_chat_id: ChatId,
    ) -> group_canister::selected_initial::SuccessResult {
        let response = super::selected_initial(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::selected_initial::Args {},
        );

        match response {
            group_canister::selected_initial::Response::Success(result) => result,
            response => panic!("'selected_initial' error: {response:?}"),
        }
    }

    pub fn selected_updates(
        env: &PocketIc,
        sender: Principal,
        group_chat_id: ChatId,
        updates_since: TimestampMillis,
    ) -> Option<types::SelectedGroupUpdates> {
        let response = super::selected_updates_v2(
            env,
            sender,
            group_chat_id.into(),
            &group_canister::selected_updates_v2::Args { updates_since },
        );

        match response {
            group_canister::selected_updates_v2::Response::Success(result) => Some(result),
            group_canister::selected_updates_v2::Response::SuccessNoUpdates(_) => None,
            response => panic!("'selected_updates_v2' error: {response:?}"),
        }
    }

    pub fn summary(env: &PocketIc, sender: &User, group_chat_id: ChatId) -> GroupCanisterGroupChatSummary {
        let response = super::summary(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::summary::Args { on_behalf_of: None },
        );

        match response {
            group_canister::summary::Response::Success(result) => result.summary,
            response => panic!("'summary' error: {response:?}"),
        }
    }

    pub fn summary_updates(
        env: &PocketIc,
        sender: &User,
        group_chat_id: ChatId,
        updates_since: TimestampMillis,
    ) -> Option<GroupCanisterGroupChatSummaryUpdates> {
        let response = super::summary_updates(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::summary_updates::Args {
                on_behalf_of: None,
                updates_since,
            },
        );

        match response {
            group_canister::summary_updates::Response::Success(result) => Some(result.updates),
            group_canister::summary_updates::Response::SuccessNoUpdates => None,
            response => panic!("'summary_updates' error: {response:?}"),
        }
    }

    pub fn delete_messages(
        env: &mut PocketIc,
        sender: Principal,
        group_chat_id: ChatId,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: Vec<MessageId>,
    ) {
        let response = super::delete_messages(
            env,
            sender,
            group_chat_id.into(),
            &group_canister::delete_messages::Args {
                thread_root_message_index,
                message_ids,
                as_platform_moderator: None,
                correlation_id: 0,
                new_achievement: false,
            },
        );

        match response {
            group_canister::delete_messages::Response::Success => {}
            response => panic!("'delete_messages' error: {response:?}"),
        }
    }

    pub fn claim_prize(env: &mut PocketIc, sender: Principal, group_chat_id: ChatId, message_id: MessageId) {
        let response = super::claim_prize(
            env,
            sender,
            group_chat_id.into(),
            &group_canister::claim_prize::Args {
                message_id,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::claim_prize::Response::Success => {}
            response => panic!("'claim_prize' error: {response:?}"),
        }
    }

    pub fn start_video_call(
        env: &mut PocketIc,
        user: &User,
        group_chat_id: ChatId,
        message_id: MessageId,
        max_duration: Option<Milliseconds>,
    ) {
        let response = super::start_video_call(
            env,
            VIDEO_CALL_OPERATOR,
            group_chat_id.into(),
            &group_canister::start_video_call::Args {
                message_id,
                initiator: user.user_id,
                initiator_username: user.username(),
                initiator_display_name: None,
                max_duration,
                call_type: VideoCallType::Broadcast,
            },
        );

        match response {
            group_canister::start_video_call::Response::Success => {}
            response => panic!("'start_video_call' error: {response:?}"),
        }
    }

    pub fn join_video_call(env: &mut PocketIc, sender: Principal, group_chat_id: ChatId, message_id: MessageId) {
        let response = super::join_video_call(
            env,
            sender,
            group_chat_id.into(),
            &group_canister::join_video_call::Args {
                message_id,
                new_achievement: false,
            },
        );

        match response {
            group_canister::join_video_call::Response::Success => {}
            response => panic!("'join_video_call' error: {response:?}"),
        }
    }

    pub fn end_video_call(env: &mut PocketIc, group_chat_id: ChatId, message_id: MessageId) {
        let response = super::end_video_call(
            env,
            VIDEO_CALL_OPERATOR,
            group_chat_id.into(),
            &group_canister::end_video_call::Args { message_id },
        );

        match response {
            group_canister::end_video_call::Response::Success => {}
            response => panic!("'end_video_call' error: {response:?}"),
        }
    }

    pub fn block_user(env: &mut PocketIc, sender: Principal, group_chat_id: ChatId, user_id: UserId) {
        let response = super::block_user(
            env,
            sender,
            group_chat_id.into(),
            &group_canister::block_user::Args {
                user_id,
                correlation_id: 0,
            },
        );

        match response {
            group_canister::block_user::Response::Success => {}
            response => panic!("'block_user' error: {response:?}"),
        }
    }

    pub fn add_reaction(
        env: &mut PocketIc,
        sender: &User,
        group_chat_id: ChatId,
        reaction: impl ToString,
        message_id: MessageId,
    ) {
        let response = super::add_reaction(
            env,
            sender.principal,
            group_chat_id.into(),
            &group_canister::add_reaction::Args {
                thread_root_message_index: None,
                message_id,
                reaction: Reaction::new(reaction.to_string()),
                correlation_id: 0,
                username: sender.username(),
                display_name: None,
                new_achievement: false,
            },
        );
        assert!(matches!(response, group_canister::add_reaction::Response::Success));
    }

    pub fn accept_p2p_swap(env: &mut PocketIc, sender: &User, group_id: ChatId, message_id: MessageId) {
        let response = super::accept_p2p_swap(
            env,
            sender.principal,
            group_id.into(),
            &group_canister::accept_p2p_swap::Args {
                thread_root_message_index: None,
                message_id,
                pin: None,
                new_achievement: false,
            },
        );

        match response {
            group_canister::accept_p2p_swap::Response::Success(_) => {}
            response => panic!("'accept_p2p_swap' error: {response:?}"),
        }
    }
}
