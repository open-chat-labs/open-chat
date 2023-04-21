use crate::guards::caller_is_dev_team_dfx_principal;
use crate::mutate_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::add_referral_codes::{Response::*, *};

#[update(guard = "caller_is_dev_team_dfx_principal")]
#[trace]
fn add_referral_codes(args: Args) -> Response {
    if matches!(args.referral_type, ReferralType::User) {
        panic!("Cannot add referral code of type User");
    }

    mutate_state(|state| {
        let now = state.env.now();
        for code in args.codes {
            state.data.referral_codes.add(args.referral_type.clone(), code, now);
        }
    });

    Success
}
