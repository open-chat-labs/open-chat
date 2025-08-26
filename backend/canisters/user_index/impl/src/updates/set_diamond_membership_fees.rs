use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{DiamondMembershipFees, DiamondMembershipFeesByDuration};
use user_index_canister::set_diamond_membership_fees::{Response::*, *};

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_diamond_membership_fees(args: Args) -> Response {
    mutate_state(|state| set_diamond_membership_fees_impl(args, state))
}

fn set_diamond_membership_fees_impl(args: Args, state: &mut RuntimeState) -> Response {
    if fees_valid(&args.fees) {
        state.data.diamond_membership_fees = args.fees;
        Success
    } else {
        Invalid
    }
}

fn fees_valid(fees: &DiamondMembershipFees) -> bool {
    fees_by_duration_valid(&fees.chat_fees) && fees_by_duration_valid(&fees.icp_fees)
}

fn fees_by_duration_valid(fees: &DiamondMembershipFeesByDuration) -> bool {
    (fees.one_month < fees.three_months) && (fees.three_months < fees.one_year) && (fees.one_year < fees.lifetime)
}
