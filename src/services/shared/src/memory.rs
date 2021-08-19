pub fn get_memory_usage() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        (core::arch::wasm32::memory_size(0) * 65536) as u64
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        // This branch won't actually ever be taken
        1024 * 1024 * 100 // 100Mb
    }
}
