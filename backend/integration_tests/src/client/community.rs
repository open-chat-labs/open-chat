use crate::{generate_query_call, generate_update_call};
use community_canister::*;

// Queries
generate_query_call!(channel_summary);
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(search_channel);
generate_query_call!(selected_channel_initial);
generate_query_call!(selected_initial);
generate_query_call!(selected_updates_v2);
generate_query_call!(summary);
generate_query_call!(summary_updates);

// Updates
generate_update_call!(add_reaction);
generate_update_call!(block_user);
generate_update_call!(cancel_invites);
generate_update_call!(change_role);
generate_update_call!(claim_prize);
generate_update_call!(create_channel);
generate_update_call!(create_user_group);
generate_update_call!(delete_messages);
generate_update_call!(delete_user_groups);
generate_update_call!(edit_message);
generate_update_call!(enable_invite_code);
generate_update_call!(import_group);
generate_update_call!(leave_channel);
generate_update_call!(remove_member);
generate_update_call!(remove_member_from_channel);
generate_update_call!(remove_reaction);
generate_update_call!(send_message);
generate_update_call!(unblock_user);
generate_update_call!(undelete_messages);
generate_update_call!(update_channel);
generate_update_call!(update_community);
generate_update_call!(update_user_group);

pub mod happy_path {
    use crate::rng::random_message_id;
    use crate::User;
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{
        AccessGate, ChannelId, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary,
        CommunityCanisterCommunitySummaryUpdates, CommunityId, CommunityRole, EventIndex, EventsResponse,
        MessageContentInitial, MessageId, MessageIndex, Rules, TextContent, TimestampMillis, UserId,
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
                permissions_v2: None,
                events_ttl: None,
                gate: None,
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
                permissions_v2: None,
                events_ttl: None,
                gate: Some(gate),
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
                message_id: message_id.unwrap_or_else(random_message_id),
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                sender_name: sender.username(),
                sender_display_name: None,
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                community_rules_accepted: None,
                channel_rules_accepted: None,
                message_filter_failed: None,
            },
        );

        match response {
            community_canister::send_message::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
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
            &community_canister::summary::Args { invite_code: None },
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
}
