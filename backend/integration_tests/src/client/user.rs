use crate::{generate_msgpack_query_call, generate_msgpack_update_call, generate_update_call};
use user_canister::*;

// Queries
generate_msgpack_query_call!(chit_events);
generate_msgpack_query_call!(events);
generate_msgpack_query_call!(events_by_index);
generate_msgpack_query_call!(events_window);
generate_msgpack_query_call!(initial_state);
generate_msgpack_query_call!(message_activity_feed);
generate_msgpack_query_call!(saved_crypto_accounts);
generate_msgpack_query_call!(updates);

// Updates
generate_msgpack_update_call!(accept_p2p_swap);
generate_msgpack_update_call!(approve_transfer);
generate_msgpack_update_call!(add_reaction);
generate_msgpack_update_call!(block_user);
generate_msgpack_update_call!(cancel_message_reminder);
generate_msgpack_update_call!(cancel_p2p_swap);
generate_msgpack_update_call!(claim_daily_chit);
generate_msgpack_update_call!(create_community);
generate_msgpack_update_call!(create_group);
generate_msgpack_update_call!(delete_community);
generate_msgpack_update_call!(delete_direct_chat);
generate_msgpack_update_call!(delete_group);
generate_msgpack_update_call!(delete_messages);
generate_msgpack_update_call!(edit_message_v2);
generate_update_call!(end_video_call_v2);
generate_msgpack_update_call!(join_video_call);
generate_msgpack_update_call!(leave_community);
generate_msgpack_update_call!(leave_group);
generate_msgpack_update_call!(mark_message_activity_feed_read);
generate_msgpack_update_call!(mark_read);
generate_msgpack_update_call!(mute_notifications);
generate_msgpack_update_call!(pay_for_streak_insurance);
generate_msgpack_update_call!(remove_reaction);
generate_msgpack_update_call!(save_crypto_account);
generate_msgpack_update_call!(send_message_v2);
generate_msgpack_update_call!(send_message_with_transfer_to_channel);
generate_msgpack_update_call!(send_message_with_transfer_to_group);
generate_msgpack_update_call!(set_message_reminder_v2);
generate_msgpack_update_call!(set_pin_number);
generate_update_call!(start_video_call_v2);
generate_msgpack_update_call!(tip_message);
generate_msgpack_update_call!(unblock_user);
generate_msgpack_update_call!(undelete_messages);
generate_msgpack_update_call!(update_chat_settings);

pub mod happy_path {
    use crate::User;
    use crate::env::VIDEO_CALL_OPERATOR;
    use pocket_ic::PocketIc;
    use testing::rng::random_from_u128;
    use types::{
        CanisterId, Chat, ChatId, CommunityId, EventIndex, EventsResponse, MessageContentInitial, MessageId, MessageIndex,
        Milliseconds, Reaction, ReplyContext, Rules, TextContent, TimestampMillis, UserId, VideoCallType,
    };
    use user_canister::set_pin_number::PinNumberVerification;

    pub fn send_text_message(
        env: &mut PocketIc,
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
                message_id: message_id.unwrap_or_else(random_from_u128),
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                replies_to: None,
                forwarding: false,
                block_level_markdown: false,
                message_filter_failed: None,
                pin: None,
            },
        );

        match response {
            user_canister::send_message_v2::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn send_message(
        env: &mut PocketIc,
        sender: &User,
        recipient: UserId,
        thread_root_message_index: Option<MessageIndex>,
        content: MessageContentInitial,
        replies_to: Option<ReplyContext>,
        message_id: Option<MessageId>,
    ) -> user_canister::send_message_v2::SuccessResult {
        let response = super::send_message_v2(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::send_message_v2::Args {
                recipient,
                thread_root_message_index,
                message_id: message_id.unwrap_or_else(random_from_u128),
                content,
                replies_to,
                forwarding: false,
                block_level_markdown: false,
                message_filter_failed: None,

                pin: None,
            },
        );

        match response {
            user_canister::send_message_v2::Response::Success(result) => result,
            user_canister::send_message_v2::Response::TransferSuccessV2(result) => result.into(),
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn edit_text_message(
        env: &mut PocketIc,
        sender: &User,
        user_id: UserId,
        message_id: MessageId,
        text: impl ToString,
        block_level_markdown: Option<bool>,
    ) {
        let response = super::edit_message_v2(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::edit_message_v2::Args {
                user_id,
                thread_root_message_index: None,
                message_id,
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                block_level_markdown,
            },
        );

        match response {
            user_canister::edit_message_v2::Response::Success => {}
            response => panic!("'edit_message_v2' error: {response:?}"),
        }
    }

    pub fn create_group(
        env: &mut PocketIc,
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
                messages_visible_to_non_members: None,
                permissions_v2: None,
                rules: Rules::default(),
                events_ttl: None,
                gate_config: None,
            },
        );

        match response {
            user_canister::create_group::Response::Success(result) => result.chat_id,
            response => panic!("'create_group' error: {response:?}"),
        }
    }

    pub fn create_community(
        env: &mut PocketIc,
        sender: &User,
        name: &str,
        is_public: bool,
        default_channels: Vec<String>,
    ) -> CommunityId {
        let response = super::create_community(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::create_community::Args {
                is_public,
                name: name.to_string(),
                description: format!("{name}_description"),
                avatar: None,
                banner: None,
                history_visible_to_new_joiners: is_public,
                permissions: None,
                rules: Rules::default(),
                gate_config: None,
                default_channels,
                default_channel_rules: None,
                primary_language: "en".to_string(),
            },
        );

        match response {
            user_canister::create_community::Response::Success(result) => result.community_id,
            response => panic!("'create_community' error: {response:?}"),
        }
    }

    pub fn add_reaction(env: &mut PocketIc, sender: &User, user_id: UserId, reaction: impl ToString, message_id: MessageId) {
        let response = super::add_reaction(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::add_reaction::Args {
                user_id,
                thread_root_message_index: None,
                message_id,
                reaction: Reaction::new(reaction.to_string()),
            },
        );
        assert!(matches!(response, user_canister::add_reaction::Response::Success));
    }

    pub fn initial_state(env: &PocketIc, sender: &User) -> user_canister::initial_state::SuccessResult {
        let response = super::initial_state(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::initial_state::Args {},
        );

        let user_canister::initial_state::Response::Success(result) = response;
        result
    }

    pub fn events(
        env: &PocketIc,
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
                latest_known_update: None,
            },
        );

        match response {
            user_canister::events::Response::Success(result) => result,
            response => panic!("'events' error: {response:?}"),
        }
    }

    pub fn events_by_index(env: &PocketIc, sender: &User, user_id: UserId, events: Vec<EventIndex>) -> EventsResponse {
        let response = super::events_by_index(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::events_by_index::Args {
                user_id,
                thread_root_message_index: None,
                events,
                latest_known_update: None,
            },
        );

        match response {
            user_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }

    pub fn events_window(
        env: &PocketIc,
        sender: &User,
        user_id: UserId,
        mid_point: MessageIndex,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResponse {
        let response = super::events_window(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::events_window::Args {
                user_id,
                thread_root_message_index: None,
                mid_point,
                max_messages,
                max_events,
                latest_known_update: None,
            },
        );

        match response {
            user_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }

    pub fn leave_group(env: &mut PocketIc, user: &User, group_id: ChatId) {
        let response = super::leave_group(
            env,
            user.principal,
            user.canister(),
            &user_canister::leave_group::Args { chat_id: group_id },
        );

        assert!(matches!(response, user_canister::leave_group::Response::Success));
    }

    pub fn leave_community(env: &mut PocketIc, user: &User, community_id: CommunityId) {
        let response = super::leave_community(
            env,
            user.principal,
            user.canister(),
            &user_canister::leave_community::Args { community_id },
        );

        assert!(matches!(response, user_canister::leave_community::Response::Success));
    }

    pub fn updates(
        env: &PocketIc,
        user: &User,
        updates_since: TimestampMillis,
    ) -> Option<user_canister::updates::SuccessResult> {
        let response = super::updates(
            env,
            user.principal,
            user.canister(),
            &user_canister::updates::Args { updates_since },
        );

        match response {
            user_canister::updates::Response::Success(result) => Some(result),
            user_canister::updates::Response::SuccessNoUpdates => None,
        }
    }

    pub fn message_activity_feed(
        env: &PocketIc,
        user: &User,
        since: TimestampMillis,
    ) -> user_canister::message_activity_feed::SuccessResult {
        let response = super::message_activity_feed(
            env,
            user.principal,
            user.canister(),
            &user_canister::message_activity_feed::Args { since },
        );

        match response {
            user_canister::message_activity_feed::Response::Success(success_result) => success_result,
        }
    }

    #[expect(clippy::too_many_arguments)]
    pub fn tip_message(
        env: &mut PocketIc,
        sender: &User,
        recipient: UserId,
        chat: Chat,
        message_id: MessageId,
        ledger: CanisterId,
        token_symbol: String,
        amount: u128,
        fee: u128,
    ) {
        let response = super::tip_message(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::tip_message::Args {
                chat,
                recipient,
                thread_root_message_index: None,
                message_id,
                ledger,
                amount,
                fee,
                decimals: 8,
                token_symbol,
                pin: None,
            },
        );

        match response {
            user_canister::tip_message::Response::Success => (),
            response => panic!("'tip_message' error: {response:?}"),
        }
    }

    pub fn start_video_call(
        env: &mut PocketIc,
        user: &User,
        recipient: UserId,
        message_id: MessageId,
        max_duration: Option<Milliseconds>,
    ) {
        let response = super::start_video_call_v2(
            env,
            VIDEO_CALL_OPERATOR,
            recipient.into(),
            &user_canister::start_video_call_v2::Args {
                message_id,
                initiator: user.user_id,
                initiator_username: user.username(),
                initiator_display_name: None,
                initiator_avatar_id: None,
                max_duration,
                call_type: VideoCallType::Default,
            },
        );

        assert!(matches!(response, user_canister::start_video_call_v2::Response::Success))
    }

    pub fn join_video_call(env: &mut PocketIc, joiner: &User, other: UserId, message_id: MessageId) {
        let response = super::join_video_call(
            env,
            joiner.principal,
            joiner.canister(),
            &user_canister::join_video_call::Args {
                user_id: other,
                message_id,
            },
        );

        assert!(matches!(response, user_canister::join_video_call::Response::Success))
    }

    pub fn end_video_call(env: &mut PocketIc, initiator: UserId, recipient: UserId, message_id: MessageId) {
        let response = super::end_video_call_v2(
            env,
            VIDEO_CALL_OPERATOR,
            recipient.into(),
            &user_canister::end_video_call_v2::Args {
                user_id: initiator,
                message_id,
            },
        );

        assert!(matches!(response, user_canister::end_video_call_v2::Response::Success))
    }

    pub fn set_pin_number(env: &mut PocketIc, user: &User, current: Option<String>, new: Option<String>) {
        let verification = current
            .map(|p| PinNumberVerification::PIN(p.into()))
            .unwrap_or(PinNumberVerification::None);

        let response = super::set_pin_number(
            env,
            user.principal,
            user.canister(),
            &user_canister::set_pin_number::Args {
                verification,
                new: new.map(|p| p.into()),
            },
        );

        assert!(matches!(response, user_canister::set_pin_number::Response::Success));
    }

    pub fn chit_events(
        env: &PocketIc,
        sender: &User,
        from: Option<TimestampMillis>,
        to: Option<TimestampMillis>,
        max: u32,
    ) -> user_canister::chit_events::SuccessResult {
        let response = super::chit_events(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::chit_events::Args {
                from,
                to,
                skip: None,
                max,
                ascending: false,
            },
        );

        match response {
            user_canister::chit_events::Response::Success(result) => result,
        }
    }

    pub fn claim_daily_chit(
        env: &mut PocketIc,
        sender: &User,
        utc_offset_mins: Option<i16>,
    ) -> user_canister::claim_daily_chit::SuccessResult {
        let response = super::claim_daily_chit(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::claim_daily_chit::Args { utc_offset_mins },
        );

        match response {
            user_canister::claim_daily_chit::Response::Success(result) => result,
            response => panic!("'claim_daily_chit' error: {response:?}"),
        }
    }

    pub fn accept_p2p_swap(env: &mut PocketIc, sender: &User, user_id: UserId, message_id: MessageId) {
        let accept_offer_response = super::accept_p2p_swap(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::accept_p2p_swap::Args {
                thread_root_message_index: None,
                message_id,
                pin: None,
                user_id,
            },
        );

        assert!(matches!(
            accept_offer_response,
            user_canister::accept_p2p_swap::Response::Success(_)
        ));
    }

    pub fn approve_transfer(env: &mut PocketIc, user: &User, args: &user_canister::approve_transfer::Args) {
        let response = super::approve_transfer(env, user.principal, user.canister(), args);

        match response {
            user_canister::approve_transfer::Response::Success => (),
            response => panic!("'approve_transfer' error: {response:?}"),
        };
    }

    pub fn block_user(env: &mut PocketIc, user: &User, blocked: UserId) {
        let response = super::block_user(
            env,
            user.principal,
            user.canister(),
            &user_canister::block_user::Args { user_id: blocked },
        );

        assert!(matches!(response, user_canister::block_user::Response::Success));
    }

    pub fn unblock_user(env: &mut PocketIc, user: &User, unblocked: UserId) {
        let response = super::unblock_user(
            env,
            user.principal,
            user.canister(),
            &user_canister::unblock_user::Args { user_id: unblocked },
        );

        assert!(matches!(response, user_canister::unblock_user::Response::Success));
    }

    pub fn pay_for_streak_insurance(env: &mut PocketIc, user: &User, additional_days: u8, expected_price: u128) {
        let pay_for_insurance_response = super::pay_for_streak_insurance(
            env,
            user.principal,
            user.canister(),
            &user_canister::pay_for_streak_insurance::Args {
                additional_days,
                expected_price,
                pin: None,
            },
        );
        assert!(
            matches!(
                pay_for_insurance_response,
                user_canister::pay_for_streak_insurance::Response::Success
            ),
            "{pay_for_insurance_response:?}"
        );
    }

    pub fn update_chat_settings(env: &mut PocketIc, user: &User, args: &user_canister::update_chat_settings::Args) {
        let response = super::update_chat_settings(env, user.principal, user.canister(), args);
        assert!(matches!(response, user_canister::update_chat_settings::Response::Success));
    }
}
