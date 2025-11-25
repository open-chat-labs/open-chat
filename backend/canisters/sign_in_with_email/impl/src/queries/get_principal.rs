use crate::guards::caller_is_whitelisted;
use crate::{env, state};
use candid::Principal;
use ic_canister_sig_creation::CanisterSigPublicKey;
use ic_cdk::query;
use sign_in_with_email_canister::GetPrincipalArgs;

#[query(guard = "caller_is_whitelisted")]
fn get_principal(args: GetPrincipalArgs) -> Principal {
    state::read(|s| {
        let seed = s.calculate_seed(&args.email);
        let canister_id = env::canister_id();
        let public_key = CanisterSigPublicKey::new(canister_id, seed.to_vec()).to_der();
        Principal::self_authenticating(public_key)
    })
}
