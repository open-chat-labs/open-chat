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

fn handle_message(args: Args, state: &mut RuntimeState) -> Response {
    let caller: UserId = state.env.caller().into();
    let now = state.env.now();

    let (text, action) = if let Some(code) = try_extract_code(args.content) {
        match state.data.reward_codes.claim(code, caller, now) {
            ClaimRewardCodeResult::Success(transfer_args, transaction_hash) => (
                "Code claimed successfully! Please wait while your ICP is transferred.",
                Some(PendingAction::IcpTransfer(caller, transfer_args, transaction_hash)),
            ),
            ClaimRewardCodeResult::UserAlreadyClaimed => ("You have already claimed a reward!", None),
            ClaimRewardCodeResult::CodeAlreadyClaimed => ("That code has already been claimed!", None),
            ClaimRewardCodeResult::CodeExpired => ("That code has expired!", None),
            ClaimRewardCodeResult::CodeNotFound => ("That code is not valid!", None),
        }
    } else {
        (
            "Please send a text message containing only your reward code (eg. '1234ABCD')",
            None,
        )
    };

    if let Some(a) = action {
        state.data.pending_actions.add(a, now);
    }

    Success(SuccessResult {
        bot_name: state.data.bot_name.clone(),
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
