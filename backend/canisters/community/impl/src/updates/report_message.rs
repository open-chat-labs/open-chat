use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::Reader;
use community_canister::report_message::{Response::*, *};
use ic_cdk_macros::update;
use types::{CanisterId, Chat};
use user_index_canister::c2c_report_message;

#[update]
#[trace]
async fn report_message(args: Args) -> Response {
    run_regular_jobs();

    let (c2c_args, user_index_canister) = match read_state(|state| build_c2c_args(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match user_index_canister_c2c_client::c2c_report_message(user_index_canister, &c2c_args).await {
        Ok(result) => match result {
            c2c_report_message::Response::Success => Success,
            c2c_report_message::Response::InternalError(err) => InternalError(err),
        },
        Err(err) => InternalError(format!("{err:?}")),
    }
}

fn build_c2c_args(args: Args, state: &RuntimeState) -> Result<(c2c_report_message::Args, CanisterId), Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        let user_id = member.user_id;

        if let Some(channel) = state.data.channels.get(&args.channel_id) {
            let chat = &channel.chat;

            if let Some(channel_member) = chat.members.get(&user_id) {
                if let Some(events_reader) = channel
                    .chat
                    .events
                    .events_reader(channel_member.min_visible_event_index(), args.thread_root_message_index)
                {
                    if let Some(message) = events_reader.message(args.message_id.into(), Some(user_id)) {
                        Ok((
                            c2c_report_message::Args {
                                reporter: user_id,
                                chat_id: Chat::Channel(state.env.canister_id().into(), args.channel_id),
                                thread_root_message_index: args.thread_root_message_index,
                                message,
                                reason_code: args.reason_code,
                                notes: args.notes,
                            },
                            state.data.user_index_canister_id,
                        ))
                    } else {
                        Err(MessageNotFound)
                    }
                } else {
                    Err(MessageNotFound)
                }
            } else {
                Err(UserNotInChannel)
            }
        } else {
            Err(ChannelNotFound)
        }
    } else {
        Err(UserNotInCommunity)
    }
}
