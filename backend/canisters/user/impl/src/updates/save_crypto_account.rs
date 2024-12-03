use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ic_ledger_types::AccountIdentifier;
use user_canister::save_crypto_account::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn save_crypto_account(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| save_crypto_account_impl(args, state))
}

fn save_crypto_account_impl(mut args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    args.name = args.name.trim().to_string();
    args.name.truncate(25);
    args.account = args.account.trim().to_string();

    let valid = Principal::from_text(&args.account).is_ok() || AccountIdentifier::from_hex(&args.account).is_ok();

    if valid {
        for named_account in state.data.saved_crypto_accounts.iter_mut() {
            if named_account.account == args.account {
                named_account.name = args.name;
                return Success;
            }
            if named_account.name == args.name {
                return NameTaken;
            }
        }
        state.data.saved_crypto_accounts.push(args);
        Success
    } else {
        Invalid
    }
}
