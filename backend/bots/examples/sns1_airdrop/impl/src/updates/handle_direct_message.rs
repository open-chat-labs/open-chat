use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use sns1_airdrop::handle_direct_message::*;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{BotMessage, MessageContent, TextContent, UserId};

#[update_msgpack]
#[trace]
fn handle_direct_message(args: Args) -> Response {
    mutate_state(|state| handle_message(args, state))
}

fn handle_message(args: Args, state: &mut RuntimeState) -> Response {
    let text = build_text(args, state);

    Success(SuccessResult {
        bot_name: state.data.bot_name.clone(),
        messages: vec![BotMessage {
            content: MessageContent::Text(TextContent { text }),
        }],
    })
}

fn build_text(args: Args, state: &mut RuntimeState) -> String {
    if state.data.completed {
        return "Registrations are no longer open".to_string();
    }

    let caller: UserId = state.env.caller().into();

    match state.data.users.entry(caller) {
        Occupied(e) => {
            let current = *e.get();
            match try_extract_principal(args.content) {
                Ok(principal) => {
                    if Some(principal) == current {
                        format!("You have already registered principal '{principal}' in the SNS-1 airdrop!")
                    } else if !state.data.principals.insert(principal) {
                        format!("Principal '{principal}' has already been registered by another user")
                    } else {
                        *e.into_mut() = Some(principal);

                        if let Some(current) = current {
                            state.data.principals.remove(&current);
                            format!("Principal successfully updated to '{principal}'!")
                        } else {
                            format!("Principal '{principal}' successfully registered for the SNS-1 airdrop!")
                        }
                    }
                }
                Err(_) => {
                    if let Some(current) = current {
                        format!(
                            "You have already registered principal '{current}' in the SNS-1 airdrop.
You can update this by sending a message containing a new principal"
                        )
                    } else {
                        "To participate in the SNS-1 airdrop you must send me a message containing your NNS principal id.
1. Sign in to https://nns.ic0.app/
2. Click on 'Neurons'
3. Copy your principal id
4. Send it to me in a message

For example '6hsbt-vqaaa-aaaaf-aaafq-cai'"
                            .to_string()
                    }
                }
            }
        }
        Vacant(_) => "Unfortunately you are not eligible for the SNS-1 airdrop".to_string(),
    }
}

fn try_extract_principal(content: MessageContent) -> Result<Principal, ()> {
    if let MessageContent::Text(TextContent { text }) = content {
        Principal::from_text(text).map_err(|_| ())
    } else {
        Err(())
    }
}
