use crate::model::pending_actions_queue::{Action, TransferCkbtc};
use crate::model::user_map::DiceRoll;
use crate::{mutate_state, RuntimeState, MAX_SATS_PER_ROLL};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use rand::RngCore;
use satoshi_dice_canister::handle_direct_message::*;
use types::{BotMessage, Cryptocurrency, MessageContent, TextContent, UserId};
use utils::time::MINUTE_IN_MS;

const CKBTC_FEE: u64 = Cryptocurrency::CKBTC.fee() as u64;

#[update_msgpack]
#[trace]
fn handle_direct_message(args: Args) -> Response {
    mutate_state(|state| handle_message(args, state))
}

fn handle_message(args: Args, state: &mut RuntimeState) -> Response {
    let mut messages = Vec::new();
    if let Some(sats) = extract_ckbtc_amount(args.content) {
        let user_id: UserId = state.env.caller().into();
        let now = state.env.now();

        if sats > MAX_SATS_PER_ROLL {
            messages.push(
                "The limit per roll is 10k SATS, so this roll won't count, please wait a moment while I refund your ckBTC"
                    .to_string(),
            );
            send_ckbtc_message(user_id, sats.saturating_sub(2 * CKBTC_FEE), state);
        } else {
            match state.data.users.time_until_next_roll_permitted(&user_id, now) {
                Some(0) => {
                    // This isn't quite uniformly distributed but it's more than good enough
                    let roll = state.env.rng().next_u64() % 101;
                    let amount_out = sats + CKBTC_FEE + (sats * roll / 100);
                    state.data.users.add_roll(
                        &user_id,
                        DiceRoll {
                            timestamp: now,
                            roll: roll as u8,
                            amount_in: sats,
                            amount_out,
                        },
                    );
                    messages.push("Let's roll the dice!".to_string());
                    messages.push(format!("Your roll was {roll}"));
                    messages.push("Please wait a moment while I transfer you your ckBTC".to_string());

                    send_ckbtc_message(user_id, amount_out, state);
                }
                Some(ms) => {
                    let minutes = (ms / MINUTE_IN_MS) + 1;
                    let s = if minutes == 1 { "" } else { "s" };
                    messages.push(format!(
                        "You can only roll the dice 5 times per hour. You can try again in {minutes} minute{s}. please wait a moment while I refund your ckBTC"
                    ));

                    send_ckbtc_message(user_id, sats.saturating_sub(2 * CKBTC_FEE), state);
                }
                None => {
                    messages.push("User not recognized, please wait a moment while I refund your ckBTC".to_string());

                    state.enqueue_pending_action(Action::TransferCkbtc(TransferCkbtc {
                        user_id,
                        amount: sats.saturating_sub(2 * CKBTC_FEE),
                        send_oc_message: false,
                    }));
                }
            }
        }
    }

    Success(SuccessResult {
        bot_name: state.data.username.clone(),
        messages: messages
            .into_iter()
            .map(|m| BotMessage {
                content: MessageContent::Text(TextContent { text: m }),
            })
            .collect(),
    })
}

fn extract_ckbtc_amount(content: MessageContent) -> Option<u64> {
    if let MessageContent::Crypto(c) = content {
        if c.transfer.token() == Cryptocurrency::CKBTC {
            return Some(c.transfer.units().try_into().unwrap());
        }
    }
    None
}

fn send_ckbtc_message(user_id: UserId, amount: u64, state: &mut RuntimeState) {
    state.enqueue_pending_action(Action::TransferCkbtc(TransferCkbtc {
        user_id,
        amount,
        send_oc_message: true,
    }));
}
