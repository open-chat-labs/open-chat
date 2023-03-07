use ic_cdk::api::management_canister;

// Get a random seed based on 'raw_rand'
pub async fn get_random_seed() -> [u8; 32] {
    let raw_rand = match management_canister::main::raw_rand().await {
        Ok((res,)) => res,
        Err((_, err)) => ic_cdk::trap(&format!("failed to get seed: {err}")),
    };

    raw_rand.as_slice().try_into().unwrap_or_else(|_| {
        ic_cdk::trap(&format!(
            "when creating seed from raw_rand output, expected raw randomness to be of length 32, got {}",
            raw_rand.len()
        ));
    })
}
