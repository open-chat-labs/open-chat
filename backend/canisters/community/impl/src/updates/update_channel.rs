use crate::updates::c2c_join_channel::join_channel_unchecked;
use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::update_channel::{Response::*, *};
use group_chat_core::UpdateResult;
use types::OptionUpdate;
use url::Url;

#[update(candid = true, msgpack = true)]
#[trace]
fn update_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_channel_impl(args, state))
}

fn update_channel_impl(mut args: Args, state: &mut RuntimeState) -> Response {
    clean_args(&mut args);

    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    if let OptionUpdate::SetToSome(external_url) = &args.external_url {
        if Url::parse(external_url).is_err() {
            return ExternalUrlInvalid;
        }
    }

    if let OptionUpdate::SetToSome(gate) = &args.gate {
        if !gate.validate() {
            return AccessGateInvalid;
        }
    }

    if let Some(name) = &args.name {
        if state.data.channels.is_name_taken(name, Some(args.channel_id)) {
            return NameTaken;
        }
    }

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let caller = state.env.caller();

        if let Some(member) = state.data.members.get(caller) {
            let now = state.env.now();
            match channel.chat.update(
                member.user_id,
                args.name,
                args.description,
                args.rules,
                args.avatar,
                args.permissions_v2,
                args.gate,
                args.public,
                args.messages_visible_to_non_members,
                args.events_ttl,
                args.external_url,
                now,
            ) {
                UpdateResult::Success(result) => {
                    if channel.chat.is_public.value && channel.chat.gate.is_none() {
                        // If the channel has just been made public or had its gate removed, join
                        // existing community members to the channel
                        if result.newly_public || matches!(result.gate_update, OptionUpdate::SetToNone) {
                            for m in state.data.members.iter_mut() {
                                if !m.channels_removed.iter().any(|c| c.value == channel.id) {
                                    join_channel_unchecked(channel, m, true, now);
                                }
                            }
                        }
                    }

                    handle_activity_notification(state);
                    SuccessV2(SuccessResult {
                        rules_version: result.rules_version,
                    })
                }
                UpdateResult::UserSuspended => UserSuspended,
                UpdateResult::UserNotInGroup => UserNotInChannel,
                UpdateResult::NotAuthorized => NotAuthorized,
                UpdateResult::NameTooShort(v) => NameTooShort(v),
                UpdateResult::NameTooLong(v) => NameTooLong(v),
                UpdateResult::NameReserved => NameReserved,
                UpdateResult::DescriptionTooLong(v) => DescriptionTooLong(v),
                UpdateResult::RulesTooShort(v) => RulesTooShort(v),
                UpdateResult::RulesTooLong(v) => RulesTooLong(v),
                UpdateResult::AvatarTooBig(v) => AvatarTooBig(v),
            }
        } else {
            UserNotInCommunity
        }
    } else {
        ChannelNotFound
    }
}

fn clean_args(args: &mut Args) {
    args.name = args.name.as_ref().map(|name| name.trim().to_string());
    args.description = args.description.as_ref().map(|desc| desc.trim().to_string());

    if let Some(rules) = &mut args.rules {
        rules.text = rules.text.trim().to_string();
    }
}
