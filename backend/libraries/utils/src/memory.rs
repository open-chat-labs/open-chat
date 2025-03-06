pub fn total() -> u64 {
    heap() + stable() + wasm_storage()
}

pub fn heap() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        core::arch::wasm32::memory_size(0) as u64 * 65536
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        // This branch won't actually ever be taken
        1024 * 1024 * 100 // 100Mb
    }
}

pub fn stable() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        ic_cdk::stable::stable_size() * 65536
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        // This branch won't actually ever be taken
        1024 * 1024 * 100 // 100Mb
    }
}

fn wasm_storage() -> u64 {
    const UPPER_LIMIT_WASM_SIZE_BYTES: u64 = 3 * 1024 * 1024; // 3MB
    UPPER_LIMIT_WASM_SIZE_BYTES
}
