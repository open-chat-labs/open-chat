use crate::model::airdrops::AirdropConfig;
use crate::model::pending_actions_queue::{Action, AirdropTransfer, AirdropType, LotteryAirdrop, MainAidrop};
use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{AccessGate, OptionUpdate, UserId};

use super::process_pending_actions;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() {
        start_airdrop_timer(state)
    } else {
        false
    }
}

pub(crate) fn start_airdrop_timer(state: &RuntimeState) -> bool {
    clear_airdrop_timer();

    if let Some(config) = state.data.airdrops.next() {
        // Start the airdrop now if the start date is in the past
        let delay = config.start.saturating_sub(state.env.now());
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay), run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub(crate) fn clear_airdrop_timer() {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
}

fn run() {
    trace!("'execute_airdrop' running");
    TIMER_ID.set(None);

    if let Some(config) = read_state(|state| state.data.airdrops.next().cloned()) {
        ic_cdk::spawn(run_airdrop(config));
    } else {
        trace!("No airdrop configured");
    };
}

async fn run_airdrop(config: AirdropConfig) {
    // Call the configured community canister to set the no-access gate on the configured channel
    match community_canister_c2c_client::update_channel(
        config.community_id.into(),
        &community_canister::update_channel::Args {
            channel_id: config.channel_id,
            name: None,
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            permissions_v2: None,
            events_ttl: OptionUpdate::NoChange,
            // TODO: This needs to be AccessGate::Locked
            gate: OptionUpdate::SetToSome(AccessGate::LifetimeDiamondMember),
            public: None,
        },
    )
    .await
    {
        Ok(community_canister::update_channel::Response::SuccessV2(_)) => (),
        Ok(resp) => {
            error!(?resp, "Failed to set no-access gate");
            return;
        }
        Err(err) => {
            error!("{err:?}");
            let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(60_000), run);
            TIMER_ID.set(Some(timer_id));
            return;
        }
    }

    // Call the configured community canister to fetch the particpants of the configured channel
    let members = match community_canister_c2c_client::selected_channel_initial(
        config.community_id.into(),
        &community_canister::selected_channel_initial::Args {
            channel_id: config.channel_id,
        },
    )
    .await
    {
        Ok(community_canister::selected_channel_initial::Response::Success(success)) => success.members,
        Ok(resp) => {
            error!(?resp, "Failed to get channel members");
            return;
        }
        Err(err) => {
            error!("{err:?}");
            let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(60_000), run);
            TIMER_ID.set(Some(timer_id));
            return;
        }
    };

    // Call the user_index to get the particpants CHIT balances for the given month
    let particpants = members.into_iter().map(|m| (m.user_id, 10000)).collect();

    // Execute the airdrop
    mutate_state(|state| execute_airdrop(particpants, state));
}

fn execute_airdrop(particpants: Vec<(UserId, u32)>, state: &mut RuntimeState) {
    let rng = state.env.rng();

    if let Some(airdrop) = state.data.airdrops.execute(particpants, rng) {
        // Add the CHAT transfer actions to the queue. When each transfer has succeeded
        // the corresponding message action will be added to the queue.

        // Add some suspense to the lottery winning messages by sending them
        // one at a time, from nth to 1st, spaced by a bunch of main airdrop messages.

        let mut lottery_winners = airdrop.outcome.lottery_winners.clone();

        for (user_id, particpant) in airdrop.outcome.participants.iter() {
            if state.data.pending_actions_queue.len() % 50 == 0 {
                if let Some((user_id, prize)) = lottery_winners.pop() {
                    state
                        .data
                        .pending_actions_queue
                        .push(Action::Transfer(Box::new(AirdropTransfer {
                            recipient: user_id,
                            amount: prize.chat_won,
                            airdrop_type: AirdropType::Lottery(LotteryAirdrop {
                                position: lottery_winners.len(),
                            }),
                        })))
                }
            }

            if let Some(prize) = &particpant.prize {
                state
                    .data
                    .pending_actions_queue
                    .push(Action::Transfer(Box::new(AirdropTransfer {
                        recipient: *user_id,
                        amount: prize.chat_won,
                        airdrop_type: AirdropType::Main(MainAidrop {
                            chit: particpant.chit,
                            shares: particpant.shares,
                        }),
                    })))
            }
        }

        loop {
            if let Some((user_id, prize)) = lottery_winners.pop() {
                state
                    .data
                    .pending_actions_queue
                    .push(Action::Transfer(Box::new(AirdropTransfer {
                        recipient: user_id,
                        amount: prize.chat_won,
                        airdrop_type: AirdropType::Lottery(LotteryAirdrop {
                            position: lottery_winners.len(),
                        }),
                    })))
            } else {
                break;
            }
        }

        process_pending_actions::start_job_if_required(state);
    }
}
