use crate::actions::Action;
use crate::guards::caller_is_admin;
use crate::jobs::execute_airdrop::start_airdrop_timer;
use crate::model::airdrops::SetNextResult;
use crate::{mutate_state, RuntimeState};
use airdrop_bot_canister::set_airdrop::*;
use canister_tracing_macros::trace;
use ic_cdk::update;

#[update(guard = "caller_is_admin")]
#[trace]
fn set_airdrop(args: Args) -> Response {
    mutate_state(|state| set_airdrop_impl(args, state))
}

fn set_airdrop_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id = args.community_id;
    let channel_id = args.channel_id;

    match state.data.airdrops.set_next(args, state.env.now()) {
        SetNextResult::Success => {
            if state.data.channels_joined.contains(&(community_id, channel_id)) {
                start_airdrop_timer(state);
            } else {
                state
                    .data
                    .pending_actions_queue
                    .push(Action::JoinChannel(community_id, channel_id));
            }
            Response::Success
        }
        SetNextResult::ChannelUsed => Response::ChannelUsed,
        SetNextResult::InThePast => Response::InThePast,
        SetNextResult::ClashesWithPrevious => Response::ClashesWithPrevious,
    }
}
