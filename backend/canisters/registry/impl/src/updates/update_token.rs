use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use registry_canister::update_token::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn update_token(args: Args) -> Response {
    mutate_state(|state| update_token_impl(args, state))
}

fn update_token_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(token) = state.data.tokens.get_mut(args.ledger_canister_id) {
        if let Some(info_url) = args.info_url {
            token.info_url = Some(info_url);
        }
        if let Some(how_to_buy_url) = args.how_to_buy_url {
            token.how_to_buy_url = Some(how_to_buy_url);
        }
        if let Some(transaction_url_format) = args.transaction_url_format {
            token.transaction_url_format = Some(transaction_url_format);
        }
        if let Some(logo) = args.logo {
            token.logo = Some(logo);
        }
        Success
    } else {
        TokenNotFound
    }
}
