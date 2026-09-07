use crate::RuntimeState;
use crate::model::moderation;
use types::OCResult;
use user_index_canister::set_authority_reporter::Args;

// Registers (or clears) the off-chain NCA reporting service's principal. Reachable only via
// propose_protected_action + confirm_protected_action (#9136): the principal gains a
// token-gated path to vaulted CSAM. Rotating the service's key is therefore a governance
// action, not a redeploy. Syncs the principal - together with the OC public key the buckets
// need to verify vault tokens - to every storage bucket.
pub(crate) fn execute(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.authority_reporter = args.principal;
    moderation::sync_authority_reporter(state);
    Ok(())
}
