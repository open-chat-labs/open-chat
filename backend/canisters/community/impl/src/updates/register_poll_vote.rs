use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{RegisterPollVoteArgs, RegisterPollVoteResult};
use community_canister::register_poll_vote::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
async fn register_poll_vote(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_poll_vote_impl(args, state))
}

fn register_poll_vote_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();

    let member = match state.data.members.get(caller) {
        Some(m) => m,
        None => return UserNotInCommunity,
    };

    if member.suspended.value {
        return UserSuspended;
    }

    let channel = match state.data.channels.get_mut(&args.channel_id) {
        Some(c) => c,
        None => return ChannelNotFound,
    };

    let channel_member = match channel.chat.members.get(&member.user_id) {
        Some(m) => m,
        None => return UserNotInChannel,
    };

    let now = state.env.now();
    let user_id = member.user_id;
    let min_visible_event_index = channel_member.min_visible_event_index();

    let result = channel.chat.events.register_poll_vote(RegisterPollVoteArgs {
        user_id,
        min_visible_event_index,
        thread_root_message_index: args.thread_root_message_index,
        message_index: args.message_index,
        option_index: args.poll_option,
        operation: args.operation,
        now,
        correlation_id: 0,
    });

    match result {
        RegisterPollVoteResult::Success(votes) => {
            handle_activity_notification(state);
            Success(votes)
        }
        RegisterPollVoteResult::SuccessNoChange(votes) => Success(votes),
        RegisterPollVoteResult::PollEnded => PollEnded,
        RegisterPollVoteResult::PollNotFound => PollNotFound,
        RegisterPollVoteResult::OptionIndexOutOfRange => OptionIndexOutOfRange,
    }
}
