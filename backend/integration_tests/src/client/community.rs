use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use community_canister::*;
use ic_stable_structures::memory_manager::MemoryId;

pub const STABLE_MEMORY_MAP_MEMORY_ID: MemoryId = MemoryId::new(3);

// Queries
generate_msgpack_query_call!(channel_summary);
generate_msgpack_query_call!(events);
generate_msgpack_query_call!(events_by_index);
generate_msgpack_query_call!(search_channel);
generate_msgpack_query_call!(selected_channel_initial);
generate_msgpack_query_call!(selected_channel_updates_v2);
generate_msgpack_query_call!(selected_initial);
generate_msgpack_query_call!(selected_updates_v2);
generate_msgpack_query_call!(summary);
generate_msgpack_query_call!(summary_updates);

// Updates
generate_msgpack_update_call!(accept_p2p_swap);
generate_msgpack_update_call!(add_bot);
generate_msgpack_update_call!(add_reaction);
generate_msgpack_update_call!(block_user);
generate_msgpack_update_call!(cancel_invites);
generate_msgpack_update_call!(cancel_p2p_swap);
generate_msgpack_update_call!(change_channel_role);
generate_msgpack_update_call!(change_role);
generate_msgpack_update_call!(claim_prize);
generate_msgpack_update_call!(create_channel);
generate_msgpack_update_call!(create_user_group);
generate_msgpack_update_call!(delete_channel);
generate_msgpack_update_call!(delete_messages);
generate_msgpack_update_call!(delete_user_groups);
generate_msgpack_update_call!(edit_message);
generate_msgpack_update_call!(enable_invite_code);
generate_msgpack_update_call!(import_group);
generate_msgpack_update_call!(leave_channel);
generate_msgpack_update_call!(register_poll_vote);
generate_msgpack_update_call!(remove_member);
generate_msgpack_update_call!(remove_member_from_channel);
generate_msgpack_update_call!(remove_reaction);
generate_msgpack_update_call!(send_message);
generate_msgpack_update_call!(unblock_user);
generate_msgpack_update_call!(undelete_messages);
generate_msgpack_update_call!(update_bot);
generate_msgpack_update_call!(update_channel);
generate_msgpack_update_call!(update_community);
generate_msgpack_update_call!(update_user_group);

pub mod happy_path {
    use crate::{client::user, User};
    use candid::Principal;
    use pocket_ic::PocketIc;
    use testing::rng::random_from_u128;
    use types::{
        AccessGate, ChannelId, ChatId, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary,
        CommunityCanisterCommunitySummaryUpdates, CommunityId, CommunityRole, EventIndex, EventsResponse, GroupReplyContext,
        GroupRole, MessageContentInitial, MessageId, MessageIndex, PollVotes, Reaction, Rules, SlashCommandPermissions,
        TextContent, TimestampMillis, UserId, VoteOperation,
    };

    pub fn create_channel(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        is_public: bool,
        name: String,
    ) -> ChannelId {
        let response = super::create_channel(
            env,
            sender,
            community_id.into(),
            &community_canister::create_channel::Args {
                is_public,
                name: name.clone(),
                description: format!("{name}_description"),
                rules: Rules::default(),
                subtype: None,
                avatar: None,
                history_visible_to_new_joiners: is_public,
                messages_visible_to_non_members: None,
                permissions_v2: None,
                events_ttl: None,
                gate_config: None,
                external_url: None,
            },
        );

        match response {
            community_canister::create_channel::Response::Success(result) => result.channel_id,
            response => panic!("'create_channel' error: {response:?}"),
        }
    }

    pub fn create_gated_channel(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        is_public: bool,
        name: String,
        gate: AccessGate,
    ) -> ChannelId {
        let response = super::create_channel(
            env,
            sender,
            community_id.into(),
            &community_canister::create_channel::Args {
                is_public,
                name: name.clone(),
                description: format!("{name}_description"),
                rules: Rules::default(),
                subtype: None,
                avatar: None,
                history_visible_to_new_joiners: is_public,
                messages_visible_to_non_members: None,
                permissions_v2: None,
                events_ttl: None,
                gate_config: Some(gate.into()),
                external_url: None,
            },
        );

        match response {
            community_canister::create_channel::Response::Success(result) => result.channel_id,
            response => panic!("'create_channel' error: {response:?}"),
        }
    }

    pub fn leave_channel(env: &mut PocketIc, sender: Principal, community_id: CommunityId, channel_id: ChannelId) {
        let response = super::leave_channel(
            env,
            sender,
            community_id.into(),
            &community_canister::leave_channel::Args { channel_id },
        );

        if !matches!(response, community_canister::leave_channel::Response::Success) {
            panic!("'leave_channel' error: {response:?}")
        }
    }

    pub fn delete_channel(env: &mut PocketIc, sender: Principal, community_id: CommunityId, channel_id: ChannelId) {
        let response = super::delete_channel(
            env,
            sender,
            community_id.into(),
            &community_canister::delete_channel::Args { channel_id },
        );

        if !matches!(response, community_canister::delete_channel::Response::Success) {
            panic!("'delete_channel' error: {response:?}")
        }
    }

    pub fn send_text_message(
        env: &mut PocketIc,
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
                message_id: message_id.unwrap_or_else(random_from_u128),
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                sender_name: sender.username(),
                sender_display_name: None,
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                block_level_markdown: false,
                community_rules_accepted: None,
                channel_rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
            },
        );

        match response {
            community_canister::send_message::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn send_message(
        env: &mut PocketIc,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
        thread_root_message_index: Option<MessageIndex>,
        content: MessageContentInitial,
        replies_to: Option<GroupReplyContext>,
        message_id: Option<MessageId>,
    ) -> community_canister::send_message::SuccessResult {
        let response = super::send_message(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::send_message::Args {
                channel_id,
                thread_root_message_index,
                message_id: message_id.unwrap_or_else(random_from_u128),
                content,
                sender_name: sender.username(),
                sender_display_name: None,
                replies_to,
                mentioned: Vec::new(),
                forwarding: false,
                block_level_markdown: false,
                community_rules_accepted: None,
                channel_rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
            },
        );

        match response {
            community_canister::send_message::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn send_message_with_transfer(
        env: &mut PocketIc,
        community_id: CommunityId,
        channel_id: ChannelId,
        sender: &User,
        content: MessageContentInitial,
        message_id: Option<MessageId>,
    ) -> user_canister::send_message_with_transfer_to_channel::SuccessResult {
        let response = user::send_message_with_transfer_to_channel(
            env,
            sender.principal,
            sender.user_id.into(),
            &user_canister::send_message_with_transfer_to_channel::Args {
                channel_id,
                thread_root_message_index: None,
                message_id: message_id.unwrap_or_else(random_from_u128),
                content,
                replies_to: None,
                block_level_markdown: false,
                message_filter_failed: None,
                sender_name: sender.username(),
                sender_display_name: None,
                mentioned: Vec::new(),
                community_rules_accepted: None,
                channel_rules_accepted: None,
                community_id,
                pin: None,
            },
        );

        match response {
            user_canister::send_message_with_transfer_to_channel::Response::Success(result) => result,
            response => panic!("'send_message_with_transfer_to_channel' error: {response:?}"),
        }
    }

    pub fn update_community(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        args: &community_canister::update_community::Args,
    ) {
        let response = super::update_community(env, sender, community_id.into(), args);

        match response {
            community_canister::update_community::Response::SuccessV2(_) => {}
            response => panic!("'update_community' error: {response:?}"),
        }
    }

    pub fn update_channel(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        args: &community_canister::update_channel::Args,
    ) {
        let response = super::update_channel(env, sender, community_id.into(), args);

        match response {
            community_canister::update_channel::Response::SuccessV2(_) => {}
            response => panic!("'update_channel' error: {response:?}"),
        }
    }

    pub fn change_role(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        user_id: UserId,
        new_role: CommunityRole,
    ) {
        let response = super::change_role(
            env,
            sender,
            community_id.into(),
            &community_canister::change_role::Args { user_id, new_role },
        );

        match response {
            community_canister::change_role::Response::Success => {}
            response => panic!("'change_role' error: {response:?}"),
        }
    }

    pub fn change_channel_role(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        channel_id: ChannelId,
        user_id: UserId,
        new_role: GroupRole,
    ) {
        let response = super::change_channel_role(
            env,
            sender,
            community_id.into(),
            &community_canister::change_channel_role::Args {
                user_id,
                new_role,
                channel_id,
            },
        );

        match response {
            community_canister::change_channel_role::Response::Success => {}
            response => panic!("'change_channel_role' error: {response:?}"),
        }
    }

    pub fn create_user_group(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        name: String,
        user_ids: Vec<UserId>,
    ) -> u32 {
        let response = super::create_user_group(
            env,
            sender,
            community_id.into(),
            &community_canister::create_user_group::Args { name, user_ids },
        );

        match response {
            community_canister::create_user_group::Response::Success(r) => r.user_group_id,
            response => panic!("'create_user_group' error: {response:?}"),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn events(
        env: &PocketIc,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
        start_index: EventIndex,
        ascending: bool,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResponse {
        let response = super::events(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::events::Args {
                channel_id,
                thread_root_message_index: None,
                start_index,
                ascending,
                max_messages,
                max_events,
                latest_known_update: None,
            },
        );

        match response {
            community_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }

    pub fn events_by_index(
        env: &PocketIc,
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
                latest_known_update: None,
            },
        );

        match response {
            community_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }

    pub fn summary(env: &PocketIc, sender: &User, community_id: CommunityId) -> CommunityCanisterCommunitySummary {
        let response = super::summary(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::summary::Args {
                on_behalf_of: None,
                invite_code: None,
            },
        );

        match response {
            community_canister::summary::Response::Success(result) => result,
            response => panic!("'summary' error: {response:?}"),
        }
    }

    pub fn summary_updates(
        env: &PocketIc,
        sender: &User,
        community_id: CommunityId,
        updates_since: TimestampMillis,
    ) -> Option<CommunityCanisterCommunitySummaryUpdates> {
        match super::summary_updates(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::summary_updates::Args {
                on_behalf_of: None,
                invite_code: None,
                updates_since,
            },
        ) {
            community_canister::summary_updates::Response::Success(result) => Some(result),
            community_canister::summary_updates::Response::SuccessNoUpdates => None,
            response => panic!("'summary_updates' error: {response:?}"),
        }
    }

    pub fn selected_initial(
        env: &PocketIc,
        sender: &User,
        community_id: CommunityId,
    ) -> community_canister::selected_initial::SuccessResult {
        let response = super::selected_initial(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::selected_initial::Args { invite_code: None },
        );

        match response {
            community_canister::selected_initial::Response::Success(result) => result,
            response => panic!("'selected_initial' error: {response:?}"),
        }
    }

    pub fn selected_updates(
        env: &PocketIc,
        sender: Principal,
        community_id: CommunityId,
        updates_since: TimestampMillis,
    ) -> Option<community_canister::selected_updates_v2::SuccessResult> {
        let response = super::selected_updates_v2(
            env,
            sender,
            community_id.into(),
            &community_canister::selected_updates_v2::Args {
                invite_code: None,
                updates_since,
            },
        );

        match response {
            community_canister::selected_updates_v2::Response::Success(result) => Some(result),
            community_canister::selected_updates_v2::Response::SuccessNoUpdates(_) => None,
            response => panic!("'selected_updates_v2' error: {response:?}"),
        }
    }

    pub fn channel_summary(
        env: &PocketIc,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
    ) -> CommunityCanisterChannelSummary {
        let response = super::channel_summary(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::channel_summary::Args {
                channel_id,
                invite_code: None,
            },
        );

        match response {
            community_canister::channel_summary::Response::Success(result) => result,
            response => panic!("'channel_summary' error: {response:?}"),
        }
    }

    pub fn selected_channel_initial(
        env: &PocketIc,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
    ) -> community_canister::selected_channel_initial::SuccessResult {
        let response = super::selected_channel_initial(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::selected_channel_initial::Args { channel_id },
        );

        match response {
            community_canister::selected_channel_initial::Response::Success(result) => result,
            response => panic!("'selected_channel_initial' error: {response:?}"),
        }
    }

    pub fn selected_channel_updates(
        env: &PocketIc,
        sender: Principal,
        community_id: CommunityId,
        channel_id: ChannelId,
        updates_since: TimestampMillis,
    ) -> Option<types::SelectedGroupUpdates> {
        let response = super::selected_channel_updates_v2(
            env,
            sender,
            community_id.into(),
            &community_canister::selected_channel_updates_v2::Args {
                channel_id,
                updates_since,
            },
        );

        match response {
            community_canister::selected_channel_updates_v2::Response::Success(result) => Some(result),
            community_canister::selected_channel_updates_v2::Response::SuccessNoUpdates(_) => None,
            response => panic!("'selected_channel_updates_v2' error: {response:?}"),
        }
    }

    pub fn cancel_invites(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        user_ids: Vec<UserId>,
        channel_id: Option<ChannelId>,
    ) {
        let response = super::cancel_invites(
            env,
            sender,
            community_id.into(),
            &community_canister::cancel_invites::Args { channel_id, user_ids },
        );

        match response {
            community_canister::cancel_invites::Response::Success => {}
            response => panic!("'cancel_invites' error: {response:?}"),
        }
    }

    pub fn claim_prize(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        channel_id: ChannelId,
        message_id: MessageId,
    ) {
        let response = super::claim_prize(
            env,
            sender,
            community_id.into(),
            &community_canister::claim_prize::Args { channel_id, message_id },
        );

        match response {
            community_canister::claim_prize::Response::Success => {}
            response => panic!("'claim_prize' error: {response:?}"),
        }
    }

    pub fn import_group(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        group_id: ChatId,
    ) -> community_canister::import_group::SuccessResult {
        let response = super::import_group(
            env,
            sender,
            community_id.into(),
            &community_canister::import_group::Args { group_id },
        );

        match response {
            community_canister::import_group::Response::Success(r) => r,
            response => panic!("'import_group' error: {response:?}"),
        }
    }

    pub fn add_reaction(
        env: &mut PocketIc,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
        reaction: impl ToString,
        message_id: MessageId,
    ) {
        let response = super::add_reaction(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::add_reaction::Args {
                channel_id,
                thread_root_message_index: None,
                message_id,
                reaction: Reaction::new(reaction.to_string()),
                username: sender.username(),
                display_name: None,
                new_achievement: false,
            },
        );
        assert!(matches!(response, community_canister::add_reaction::Response::Success));
    }

    pub fn register_poll_vote(
        env: &mut PocketIc,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
        message_index: MessageIndex,
        poll_option: u32,
    ) -> PollVotes {
        let response = super::register_poll_vote(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::register_poll_vote::Args {
                channel_id,
                thread_root_message_index: None,
                message_index,
                poll_option,
                operation: VoteOperation::RegisterVote,
                new_achievement: false,
            },
        );

        match response {
            community_canister::register_poll_vote::Response::Success(result) => result,
            response => panic!("'register_poll_vote' error: {response:?}"),
        }
    }

    pub fn accept_p2p_swap(
        env: &mut PocketIc,
        sender: &User,
        community_id: CommunityId,
        channel_id: ChannelId,
        message_id: MessageId,
    ) {
        let response = super::accept_p2p_swap(
            env,
            sender.principal,
            community_id.into(),
            &community_canister::accept_p2p_swap::Args {
                channel_id,
                thread_root_message_index: None,
                message_id,
                pin: None,
                new_achievement: false,
            },
        );

        match response {
            community_canister::accept_p2p_swap::Response::Success(_) => {}
            response => panic!("'accept_p2p_swap' error: {response:?}"),
        }
    }

    pub fn add_bot(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        bot_id: UserId,
        granted_permissions: SlashCommandPermissions,
    ) {
        let response = super::add_bot(
            env,
            sender,
            community_id.into(),
            &community_canister::add_bot::Args {
                bot_id,
                granted_permissions,
            },
        );

        match response {
            community_canister::add_bot::Response::Success => {}
            response => panic!("'add_bot' error: {response:?}"),
        }
    }

    pub fn update_bot(
        env: &mut PocketIc,
        sender: Principal,
        community_id: CommunityId,
        bot_id: UserId,
        granted_permissions: SlashCommandPermissions,
    ) {
        let response = super::update_bot(
            env,
            sender,
            community_id.into(),
            &community_canister::update_bot::Args {
                bot_id,
                granted_permissions,
            },
        );

        match response {
            community_canister::update_bot::Response::Success => {}
            response => panic!("'update_bot' error: {response:?}"),
        }
    }
}
