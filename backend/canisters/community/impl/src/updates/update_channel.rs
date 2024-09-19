use crate::model::expiring_members::ExpiringMember;
use crate::updates::c2c_join_channel::join_channel_unchecked;
use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::update_channel::{Response::*, *};
use group_chat_core::UpdateResult;
use ic_cdk::update;
use types::OptionUpdate;
use url::Url;

#[update]
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
            let gate_config = if args.gate_config.has_update() { args.gate_config } else { args.gate.map(|g| g.into()) };
            let prev_gate_had_expiry = channel.chat.gate_config.as_ref().map_or(false, |gc| gc.expiry().is_some());
            match channel.chat.update(
                member.user_id,
                args.name,
                args.description,
                args.rules,
                args.avatar,
                args.permissions_v2,
                gate_config,
                args.public,
                args.messages_visible_to_non_members,
                args.events_ttl,
                args.external_url,
                now,
            ) {
                UpdateResult::Success(result) => {
                    if channel.chat.is_public.value && channel.chat.gate_config.is_none() {
                        // If the channel has just been made public or had its gate removed, join
                        // existing community members to the channel
                        if result.newly_public || matches!(result.gate_config_update, OptionUpdate::SetToNone) {
                            for m in state.data.members.iter_mut() {
                                if !m.channels_removed.iter().any(|c| c.value == channel.id) {
                                    join_channel_unchecked(channel, m, true, now);
                                }
                            }
                        }
                    }

                    if prev_gate_had_expiry {
                        // If the channel has had a gate expiry removed then remove all members from expiry job
                        let gate_has_expiry = channel.chat.gate_config.as_ref().map_or(false, |gc| gc.expiry().is_some());
                        if !gate_has_expiry {
                            state.data.expiring_members.remove_matching(Some(channel.id));
                        }
                    } else {
                        // If the channel has had a gate added with an expiry then add all members to expiry job
                        if let Some(expiry) = channel.chat.gate_config.value.as_ref().map(|gc| gc.expiry()).flatten() {
                            for m in channel.chat.members.iter() {
                                state.data.expiring_members.push(ExpiringMember {
                                    expires: now + expiry,
                                    channel_id: Some(channel.id),
                                    user_id: m.user_id,
                                });
                            }
                            // TODO: Start job if necessary
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
