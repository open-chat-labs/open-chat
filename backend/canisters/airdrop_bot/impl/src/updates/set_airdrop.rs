use crate::guards::caller_is_admin;
use crate::jobs::execute_airdrop::start_airdrop_timer;
use crate::model::airdrops::{AirdropConfig, SetNextResult};
use crate::model::pending_actions_queue::Action;
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
    let config = AirdropConfig {
        community_id: args.community_id,
        channel_id: args.channel_id,
        start: args.start,
        main_chat_fund: args.main_chat_fund,
        main_chit_band: args.main_chit_band,
        lottery_prizes: args.lottery_prizes,
        lottery_chit_band: args.lottery_chit_band,
    };

    match state.data.airdrops.set_next(config, state.env.now()) {
        SetNextResult::Success => {
            if state.data.communities_joined.contains(&args.community_id) {
                start_airdrop_timer(state);
            } else {
                state.enqueue_pending_action(Action::JoinCommunity(args.community_id));
            }
            Response::Success
        }
        SetNextResult::ChannelUsed => Response::ChannelUsed,
        SetNextResult::InThePast => Response::InThePast,
        SetNextResult::ClashesWithPrevious => Response::ClashesWithPrevious,
    }
}
