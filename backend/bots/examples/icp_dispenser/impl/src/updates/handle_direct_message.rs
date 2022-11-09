use crate::model::pending_actions::PendingAction;
use crate::model::reward_codes::ClaimRewardCodeResult;
use crate::{mutate_state, RewardCodes, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use icp_dispenser_bot::handle_direct_message::*;
use types::{BotMessage, MessageContent, TextContent, UserId};

#[update_msgpack]
#[trace]
fn handle_direct_message(args: Args) -> Response {
    mutate_state(|state| handle_message(args, state))
}

fn handle_message(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller: UserId = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    let (text, action) = if let Some(code) = try_extract_code(args.content) {
        match runtime_state.data.reward_codes.claim(code, caller, now) {
            ClaimRewardCodeResult::Success(transfer_args, transaction_hash) => (
                "You successfully claimed your reward! Congratulations! 🎉 Please wait while your ICP is transferred.",
                Some(PendingAction::IcpTransfer(caller, transfer_args, transaction_hash)),
            ),
            ClaimRewardCodeResult::UserAlreadyClaimed => (
                "Oh, it looks like you've already claimed a reward! I want to be fair to everybody ✌️",
                None,
            ),
            ClaimRewardCodeResult::CodeAlreadyClaimed => {
                ("Your code can't be claimed twice! I hope you had fun seeking me 🌳", None)
            }
            ClaimRewardCodeResult::CodeExpired => ("Your code has expired! Sorry! ⏱", None),
            ClaimRewardCodeResult::CodeNotFound => {
                ("The code you entered is not valid! Can't give you a reward for that 🐾", None)
            }
        }
    } else {
        (
            "If you 
send me the right code there is ICP waiting for you. To claim your reward please send me a text message containing only your reward code (eg. '42R488IT') 🌈",
            None,
        )
    };

    if let Some(a) = action {
        runtime_state.data.pending_actions.add(a, now);
    }

    Success(SuccessResult {
        bot_name: runtime_state.data.bot_name.clone(),
        messages: vec![BotMessage {
            content: MessageContent::Text(TextContent { text: text.to_string() }),
        }],
    })
}

fn try_extract_code(content: MessageContent) -> Option<String> {
    if let MessageContent::Text(TextContent { text }) = content {
        RewardCodes::validate(&text).then_some(text.to_ascii_uppercase())
    } else {
        None
    }
}
