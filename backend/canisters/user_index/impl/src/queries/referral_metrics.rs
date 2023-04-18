use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use std::{cmp::Reverse, collections::HashMap};
use types::UserId;
use user_index_canister::referral_metrics::{Response::*, *};

#[query]
fn referral_metrics(_args: Args) -> Response {
    read_state(referral_metrics_impl)
}

#[derive(Default)]
pub struct ReferralData {
    pub paid_diamond: u32,
    pub unpaid_diamond: u32,
    pub other: u32,
    pub icp_raised_for_paid_diamond_e8s: u64,
}

fn referral_metrics_impl(runtime_state: &RuntimeState) -> Response {
    let mut user_referrals_map: HashMap<UserId, ReferralData> = HashMap::new();
    let now = runtime_state.env.now();

    for user in runtime_state.data.users.iter() {
        if let Some(referred_by) = user.referred_by {
            if let Some(referrer) = runtime_state.data.users.get_by_user_id(&referred_by) {
                if referrer.diamond_membership_details.is_active(now) {
                    let data = user_referrals_map.entry(referred_by).or_default();
                    let icp_raised_for_paid_diamond: u64 =
                        user.diamond_membership_details.payments().iter().map(|p| p.amount_e8s).sum();
                    if icp_raised_for_paid_diamond > 0 {
                        data.paid_diamond += 1;
                        data.icp_raised_for_paid_diamond_e8s += icp_raised_for_paid_diamond;
                    } else if user.diamond_membership_details.is_active(now) {
                        data.unpaid_diamond += 1;
                    } else {
                        data.other += 1;
                    }
                }
            }
        }
    }

    let mut user_referrals: Vec<ReferralData> = user_referrals_map.into_values().collect();
    user_referrals.sort_unstable_by_key(|u| Reverse(u.unpaid_diamond));

    let mut users_who_referred: u32 = 0;
    let mut users_who_referred_paid_diamond: u32 = 0;
    let mut users_who_referred_unpaid_diamond: u32 = 0;
    let mut referrals_of_paid_diamond: u32 = 0;
    let mut referrals_of_unpaid_diamond: u32 = 0;
    let mut referrals_other: u32 = 0;
    let mut icp_raised_by_referrals_to_paid_diamond_e8s: u64 = 0;

    for data in user_referrals.iter() {
        users_who_referred += 1;
        icp_raised_by_referrals_to_paid_diamond_e8s += data.icp_raised_for_paid_diamond_e8s;
        if data.paid_diamond > 0 {
            users_who_referred_paid_diamond += 1;
            referrals_of_paid_diamond += data.paid_diamond;
        }
        if data.unpaid_diamond > 0 {
            users_who_referred_unpaid_diamond += 1;
            referrals_of_unpaid_diamond += data.unpaid_diamond;
        }
        if data.other > 0 {
            referrals_other += data.other;
        }
    }

    let threshold = (referrals_of_unpaid_diamond as f32 * 0.9) as u32;
    let mut users_who_referred_90_percent_unpaid_diamond: u32 = 0;
    let mut curr_referrals_of_unpaid_diamond = 0;

    for data in user_referrals.iter() {
        users_who_referred_90_percent_unpaid_diamond += 1;
        curr_referrals_of_unpaid_diamond += data.unpaid_diamond;

        if curr_referrals_of_unpaid_diamond > threshold {
            break;
        }
    }

    Success(ReferralMetrics {
        users_who_referred,
        users_who_referred_paid_diamond,
        users_who_referred_unpaid_diamond,
        users_who_referred_90_percent_unpaid_diamond,
        referrals_of_paid_diamond,
        referrals_of_unpaid_diamond,
        referrals_other,
        icp_raised_by_referrals_to_paid_diamond: (icp_raised_by_referrals_to_paid_diamond_e8s / 100_000_000) as u32,
    })
}
