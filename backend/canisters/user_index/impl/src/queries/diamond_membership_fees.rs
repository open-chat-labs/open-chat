use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use constants::{CHAT_SYMBOL, ICP_SYMBOL};
use user_index_canister::diamond_membership_fees::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn diamond_membership_fees(_args: Args) -> Response {
    read_state(diamond_membership_fees_impl)
}

fn diamond_membership_fees_impl(state: &RuntimeState) -> Response {
    let fees = &state.data.diamond_membership_fees;

    let fees = vec![
        DiamondMembershipFees {
            token_symbol: CHAT_SYMBOL.to_string(),
            one_month: fees.chat_fees.one_month,
            three_months: fees.chat_fees.three_months,
            one_year: fees.chat_fees.one_year,
            lifetime: fees.chat_fees.lifetime,
        },
        DiamondMembershipFees {
            token_symbol: ICP_SYMBOL.to_string(),
            one_month: fees.icp_fees.one_month,
            three_months: fees.icp_fees.three_months,
            one_year: fees.icp_fees.one_year,
            lifetime: fees.icp_fees.lifetime,
        },
    ];

    Success(fees)
}
