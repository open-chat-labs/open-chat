use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::cancel_offer::{Response::*, *};

#[update_candid_and_msgpack]
#[trace]
fn cancel_offer(args: Args) -> Response {
    mutate_state(|state| cancel_offer_impl(args, state))
}

fn cancel_offer_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(offer) = state.data.offers.get_mut(args.offer_id) {
        let user_id = state.env.caller().into();
        let now = state.env.now();
        if offer.created_by != user_id {
            NotAuthorized
        } else if offer.accepted_by.is_some() {
            OfferAlreadyAccepted
        } else if offer.expires_at < now {
            OfferExpired
        } else {
            if offer.cancelled_at.is_none() {
                offer.cancelled_at = Some(now);
            }
            Success
        }
    } else {
        OfferNotFound
    }
}
