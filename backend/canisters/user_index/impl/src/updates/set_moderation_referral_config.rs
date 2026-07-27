use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{SetModerationReferralConfig, UserIndexEvent};
use types::ModerationCategories;
use user_index_canister::set_moderation_referral_config::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_moderation_referral_config(args: Args) -> Response {
    mutate_state(|state| set_moderation_referral_config_impl(args, state))
}

fn set_moderation_referral_config_impl(args: Args, state: &mut RuntimeState) -> Response {
    let mut config = args.config;
    if let Some(c) = config.as_mut() {
        let valid = c.categories.iter().all(|entry| {
            entry.category.is_power_of_two()
                && ModerationCategories::from_bits(entry.category).is_some()
                && (0.0..=1.0).contains(&entry.score_threshold)
        });
        let duplicates = c
            .categories
            .iter()
            .map(|entry| entry.category)
            .collect::<std::collections::BTreeSet<_>>()
            .len()
            != c.categories.len();
        if !valid || duplicates {
            return Response::Error(oc_error_codes::OCErrorCode::InvalidRequest.into());
        }
        // sexual/minors always takes the CSAM auto-sanction path; it can never be downgraded
        // to a referral category
        c.categories
            .retain(|entry| entry.category != ModerationCategories::SEXUAL_MINORS.bits());
    }
    let config = config.filter(|c| !c.categories.is_empty());

    state.data.moderation_referral_config = config.clone();

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::SetModerationReferralConfig(SetModerationReferralConfig { config }),
        None,
    );

    Response::Success
}
