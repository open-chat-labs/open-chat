use ic_cdk_macros::query;
use types::{Cryptocurrency, DiamondMembershipPlanDuration};
use user_index_canister::diamond_membership_fees::{Response::*, *};

#[query]
fn diamond_membership_fees(_args: Args) -> Response {
    let fees = vec![
        DiamondMembershipFees {
            token: Cryptocurrency::CHAT,
            one_month: DiamondMembershipPlanDuration::OneMonth.chat_price_e8s(),
            three_months: DiamondMembershipPlanDuration::ThreeMonths.chat_price_e8s(),
            one_year: DiamondMembershipPlanDuration::OneYear.chat_price_e8s(),
        },
        DiamondMembershipFees {
            token: Cryptocurrency::InternetComputer,
            one_month: DiamondMembershipPlanDuration::OneMonth.icp_price_e8s(),
            three_months: DiamondMembershipPlanDuration::ThreeMonths.icp_price_e8s(),
            one_year: DiamondMembershipPlanDuration::OneYear.icp_price_e8s(),
        },
    ];

    Success(fees)
}
