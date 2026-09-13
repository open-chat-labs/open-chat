use ic_cdk_management_canister as management_canister;

// Get a random seed based on 'raw_rand', trapping if the call fails
pub async fn get_random_seed() -> [u8; 32] {
    match try_get_random_seed().await {
        Ok(seed) => seed,
        Err(error) => ic_cdk::trap(error),
    }
}

// Get a random seed based on 'raw_rand'. `raw_rand` is a bounded-wait call, so a rejection is a
// legal outcome; callers that can retry should use this rather than `get_random_seed`.
pub async fn try_get_random_seed() -> Result<[u8; 32], String> {
    let raw_rand = management_canister::raw_rand()
        .await
        .map_err(|err| format!("failed to get seed: {err}"))?;

    raw_rand.as_slice().try_into().map_err(|_| {
        format!(
            "when creating seed from raw_rand output, expected raw randomness to be of length 32, got {}",
            raw_rand.len()
        )
    })
}
