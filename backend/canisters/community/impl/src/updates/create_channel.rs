use super::c2c_join_community::join_community_impl;
use crate::activity_notifications::handle_activity_notification;
use crate::guards::{caller_is_local_user_index, caller_is_proposals_bot};
use crate::model::channels::Channel;
use crate::model::events::CommunityEventInternal;
use crate::timer_job_types::JoinMembersToPublicChannelJob;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::create_channel::{Response::*, *};
use community_canister::{c2c_bot_create_channel, c2c_join_community};
use group_chat_core::GroupChatCore;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::{BotCaller, BotPermissions, Caller, ChannelCreated, CommunityPermission, MultiUserChat, OCResult, UserType};
use url::Url;
use utils::document::validate_avatar;
use utils::text_validation::{StringLengthValidationError, validate_channel_name, validate_description, validate_rules};

#[update(msgpack = true)]
#[trace]
fn create_channel(args: Args) -> Response {
    match execute_update(|state| create_channel_impl(args, false, None, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_create_channel(args: c2c_bot_create_channel::Args) -> c2c_bot_create_channel::Response {
    execute_update(|state| c2c_bot_create_channel_impl(args, state))
}

fn c2c_bot_create_channel_impl(
    args: c2c_bot_create_channel::Args,
    state: &mut RuntimeState,
) -> c2c_bot_create_channel::Response {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    match create_channel_impl(args.into(), false, Some(Caller::BotV2(bot_caller)), state) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[update(guard = "caller_is_proposals_bot", msgpack = true)]
#[trace]
fn c2c_create_proposals_channel(args: Args) -> Response {
    execute_update(|state| c2c_create_proposals_channel_impl(args, state))
}

fn c2c_create_proposals_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(response) = join_community_impl(
        &c2c_join_community::Args {
            user_id: caller.into(),
            principal: caller,
            channel_id: None,
            invite_code: None,
            referred_by: None,
            is_platform_moderator: false,
            user_type: UserType::OcControlledBot,
            diamond_membership_expires_at: None,
            verified_credential_args: None,
            unique_person_proof: None,
            total_chit_earned: 0,
        },
        Vec::new(),
        state,
    )
    .err()
    {
        match response {
            c2c_join_community::Response::Error(error) => return Error(error),
            c2c_join_community::Response::AlreadyInCommunity(_) => {}
            _ => panic!("Unexpected response from c2c_join_community"),
        }
    }

    match create_channel_impl(args, true, None, state) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn create_channel_impl(
    args: Args,
    is_proposals_channel: bool,
    ext_caller: Option<Caller>,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    if let Some(external_url) = &args.external_url
        && Url::parse(external_url).is_err()
    {
        return Err(OCErrorCode::InvalidExternalUrl.into());
    }

    let caller = state.verified_caller(ext_caller)?;

    let messages_visible_to_non_members =
        args.is_public && args.messages_visible_to_non_members.unwrap_or(args.gate_config.is_none());

    let channel_id = state.generate_channel_id();
    let subtype = is_proposals_channel.then_some(args.subtype).flatten();

    if !is_proposals_channel
        && !match &caller {
            Caller::BotV2(bot_caller) => state.data.is_bot_permitted(
                &bot_caller.bot,
                None,
                &bot_caller.initiator,
                &BotPermissions::from_community_permission(if args.is_public {
                    CommunityPermission::CreatePublicChannel
                } else {
                    CommunityPermission::CreatePrivateChannel
                }),
            ),
            _ => {
                if let Some(member) = state.data.members.get_by_user_id(&caller.agent()) {
                    if args.is_public {
                        member.role().can_create_public_channel(&state.data.permissions)
                    } else {
                        member.role().can_create_private_channel(&state.data.permissions)
                    }
                } else {
                    false
                }
            }
        }
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if let Err(error) = validate_channel_name(&args.name) {
        return Err(match error {
            StringLengthValidationError::TooShort(s) => OCErrorCode::NameTooShort.with_json(&s),
            StringLengthValidationError::TooLong(l) => OCErrorCode::NameTooLong.with_json(&l),
        });
    }

    if let Err(error) = validate_description(&args.description) {
        return Err(OCErrorCode::DescriptionTooLong.with_json(&error));
    }

    if let Err(error) = validate_rules(args.rules.enabled, &args.rules.text) {
        return Err(error.into());
    }

    if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        return Err(OCErrorCode::AvatarTooBig.with_json(&error));
    }

    if args
        .gate_config
        .as_ref()
        .map(|g| !g.validate(state.data.test_mode))
        .unwrap_or_default()
    {
        return Err(OCErrorCode::InvalidAccessGate.into());
    }

    if state.data.channels.is_name_taken(&args.name, None) {
        return Err(OCErrorCode::NameTaken.into());
    }

    let now = state.env.now();
    let permissions = args.permissions_v2.unwrap_or_default();

    let mut chat = GroupChatCore::new(
        MultiUserChat::Channel(state.env.canister_id().into(), channel_id),
        caller.agent(),
        args.is_public,
        args.name.clone(),
        args.description,
        args.rules,
        subtype,
        args.avatar,
        args.history_visible_to_new_joiners,
        messages_visible_to_non_members,
        permissions,
        args.gate_config.clone().map(|gc| gc.into()),
        args.events_ttl,
        (&caller).into(),
        state.env.rng().r#gen(),
        args.external_url,
        now,
    );

    if args.is_public {
        subscribe_bots_to_events(state, &mut chat);
    }

    state.data.members.mark_member_joined_channel(caller.agent(), channel_id);

    state.data.channels.add(Channel {
        id: channel_id,
        chat,
        date_imported: None,
    });

    if args.is_public {
        state.data.public_channel_list_updated = now;

        if args.gate_config.is_none() {
            JoinMembersToPublicChannelJob {
                channel_id,
                members: state.data.members.iter_member_ids().collect(),
            }
            .execute_with_state(state);
        }
    }

    state.push_community_event(CommunityEventInternal::ChannelCreated(Box::new(ChannelCreated {
        channel_id,
        is_public: args.is_public,
        name: args.name,
        created_by: caller.agent(),
    })));

    handle_activity_notification(state);
    Ok(SuccessResult { channel_id })
}

fn subscribe_bots_to_events(state: &mut RuntimeState, chat: &mut GroupChatCore) {
    for (bot_id, bot) in state.data.bots.iter() {
        if let (Some(subscriptions), Some(permissions)) = (&bot.default_subscriptions, &bot.autonomous_permissions) {
            chat.events.subscribe_bot_to_events(
                *bot_id,
                subscriptions.chat.clone(),
                &permissions.permitted_chat_event_categories_to_read(),
            );
        }
    }
}
