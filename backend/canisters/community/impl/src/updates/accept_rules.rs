use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::accept_rules::{Response::*, *};
use group_chat_core::AcceptRulesResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn accept_rules(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| accept_rules_impl(args, state))
}

fn accept_rules_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let user_id = member.user_id;
        let now = state.env.now();

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            match channel.chat.accept_rules(user_id, args.version, now) {
                AcceptRulesResult::Success => Success,
                AcceptRulesResult::UserSuspended => UserSuspended,
                AcceptRulesResult::UserNotInGroup => UserNotInChannel,
                AcceptRulesResult::AlreadyAccepted => RulesAlreadyAccepted,
                AcceptRulesResult::OldVersion => OldVersion,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
