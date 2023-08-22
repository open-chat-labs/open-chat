use super::c2c_join_community::join_community_impl;
use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_proposals_bot;
use crate::model::channels::Channel;
use crate::updates::c2c_join_channel::join_channel_unchecked;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_join_community;
use community_canister::create_channel::{Response::*, *};
use group_chat_core::GroupChatCore;
use ic_cdk_macros::update;
use rand::Rng;
use types::ChannelId;
use utils::document_validation::validate_avatar;
use utils::group_validation::{validate_description, validate_name, validate_rules, NameValidationError, RulesValidationError};

#[update]
#[trace]
fn create_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| create_channel_impl(args, false, state))
}

#[update_msgpack(guard = "caller_is_proposals_bot")]
#[trace]
fn c2c_create_proposals_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        let caller = state.env.caller();

        if let Some(response) = join_community_impl(
            &c2c_join_community::Args {
                user_id: caller.into(),
                principal: caller,
                invite_code: None,
                is_platform_moderator: false,
                is_bot: true,
            },
            state,
        )
        .err()
        {
            match response {
                c2c_join_community::Response::UserBlocked => return NotAuthorized,
                c2c_join_community::Response::AlreadyInCommunity(_) => {}
                _ => panic!("Unexpected response from c2c_join_community"),
            }
        }

        create_channel_impl(args, true, state)
    })
}

fn create_channel_impl(args: Args, is_proposals_channel: bool, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get_mut(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if !is_proposals_channel {
            let is_authorized = if args.is_public {
                member.role.can_create_public_channel(&state.data.permissions)
            } else {
                member.role.can_create_private_channel(&state.data.permissions)
            };

            if !is_authorized {
                return NotAuthorized;
            } else if let Err(error) = validate_name(&args.name, args.is_public) {
                return match error {
                    NameValidationError::TooShort(s) => NameTooShort(s),
                    NameValidationError::TooLong(l) => NameTooLong(l),
                    NameValidationError::Reserved => NameReserved,
                };
            }
        }

        if let Err(error) = validate_description(&args.description) {
            DescriptionTooLong(error)
        } else if let Err(error) = validate_rules(args.rules.enabled, &args.rules.text) {
            match error {
                RulesValidationError::TooShort(s) => RulesTooShort(s),
                RulesValidationError::TooLong(l) => RulesTooLong(l),
            }
        } else if let Err(error) = validate_avatar(args.avatar.as_ref()) {
            AvatarTooBig(error)
        } else if state.data.channels.is_name_taken(&args.name) {
            NameTaken
        } else {
            let now = state.env.now();
            let channel_id: ChannelId = state.env.rng().gen();
            let chat = GroupChatCore::new(
                member.user_id,
                args.is_public,
                args.name,
                args.description,
                args.rules,
                None,
                args.avatar,
                args.history_visible_to_new_joiners,
                args.permissions.unwrap_or_default(),
                args.gate,
                args.events_ttl,
                member.is_bot,
                now,
            );

            member.channels.insert(channel_id);

            let mut channel = Channel {
                id: channel_id,
                chat,
                date_imported: None,
            };

            if args.is_public && channel.chat.gate.is_none() {
                for m in state.data.members.iter_mut() {
                    join_channel_unchecked(&mut channel, m, true, now);
                }
            }

            state.data.channels.add(channel);

            handle_activity_notification(state);
            Success(SuccessResult { channel_id })
        }
    } else {
        NotAuthorized
    }
}
