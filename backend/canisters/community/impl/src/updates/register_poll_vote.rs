use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::register_poll_vote::{Response::*, *};
use types::{Achievement, Chat, EventIndex, OCResult, PollVotes, TotalVotes};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn register_poll_vote(args: Args) -> Response {
    match execute_update(|state| register_poll_vote_impl(args, state)) {
        Ok(votes) => Success(votes),
        Err(error) => Error(error),
    }
}

fn register_poll_vote_impl(args: Args, state: &mut RuntimeState) -> OCResult<PollVotes> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let user_id = member.user_id;
    let now = state.env.now();

    let result = channel.chat.register_poll_vote(
        user_id,
        args.thread_root_message_index,
        args.message_index,
        args.poll_option,
        args.operation,
        now,
    )?;

    if result.value.updated {
        if result.value.poll_creator != user_id {
            if channel
                .chat
                .members
                .get(&result.value.poll_creator)
                .is_some_and(|m| !m.user_type().is_bot())
                && let Some((message, event_index)) = channel.chat.events.message_internal(
                    EventIndex::default(),
                    args.thread_root_message_index,
                    args.message_index.into(),
                )
            {
                let event = CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                    chat: Chat::Channel(state.env.canister_id().into(), channel.id),
                    thread_root_message_index: args.thread_root_message_index,
                    message_index: message.message_index,
                    message_id: message.message_id,
                    event_index,
                    activity: MessageActivity::PollVote,
                    timestamp: now,
                    user_id: matches!(result.value.votes.total, TotalVotes::Visible(_)).then_some(user_id),
                });
                state.push_event_to_user(result.value.poll_creator, event, now);
            }

            if args.new_achievement {
                state.notify_user_of_achievement(user_id, Achievement::VotedOnPoll, now);
            }
        }

        handle_activity_notification(state);
    }

    state.push_bot_notification(result.bot_notification);
    Ok(result.value.votes)
}
