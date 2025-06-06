use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use registry_canister::TokenDetails;
use registry_canister::updates::{Response::*, *};
use types::{CanisterId, OptionUpdate};

#[query(candid = true, msgpack = true)]
#[trace]
fn updates(args: Args) -> Response {
    read_state(|state| updates_impl(args, state))
}

fn updates_impl(args: Args, state: &RuntimeState) -> Response {
    let updates_since = args.since.unwrap_or_default();
    let tokens_last_updated = state.data.tokens.last_updated();
    let last_updated = [
        tokens_last_updated,
        state.data.nervous_systems.last_updated(),
        state.data.swap_providers.timestamp,
        state.data.message_filters.last_updated(),
        state.data.airdrop_config.timestamp,
    ]
    .into_iter()
    .max()
    .unwrap();

    if updates_since < last_updated {
        let mut token_details: Option<Vec<TokenDetails>> = None;
        let mut tokens_uninstalled: Option<Vec<CanisterId>> = None;
        if tokens_last_updated > updates_since {
            for token in state.data.tokens.iter().filter(|t| t.last_updated > updates_since) {
                if token.uninstalled {
                    if let Some(u) = &mut tokens_uninstalled {
                        u.push(token.ledger_canister_id)
                    } else {
                        tokens_uninstalled = Some(vec![token.ledger_canister_id]);
                    }
                } else {
                    let token = token.clone().remove_logo_if_logo_id_set();
                    if let Some(t) = &mut token_details {
                        t.push(token)
                    } else {
                        token_details = Some(vec![token]);
                    }
                }
            }
        }

        Success(SuccessResult {
            last_updated,
            token_details,
            tokens_uninstalled,
            nervous_system_details: state
                .data
                .nervous_systems
                .get_all()
                .iter()
                .filter(|ns| ns.last_updated > updates_since)
                .map(|ns| ns.into())
                .collect(),
            swap_providers: state
                .data
                .swap_providers
                .if_set_after(updates_since)
                .map(|p| p.iter().copied().collect()),
            message_filters_added: state.data.message_filters.added_since(updates_since),
            message_filters_removed: state.data.message_filters.removed_since(updates_since),
            airdrop_config: state
                .data
                .airdrop_config
                .if_set_after(updates_since)
                .cloned()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
        })
    } else {
        SuccessNoUpdates
    }
}
