use crate::guards::caller_is_dev_team_dfx_principal;
use crate::mutate_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::add_referral_codes::{Response::*, *};

#[update(guard = "caller_is_dev_team_dfx_principal")]
#[trace]
fn add_referral_codes(args: Args) -> Response {
    mutate_state(|state| {
        for code in args.codes {
            state.data.referrer_codes.insert(code, args.referral_type.clone());
        }
    });

    Success
}
