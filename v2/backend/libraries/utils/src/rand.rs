pub fn get_random_item<T>(collection: &[T], random: usize) -> Option<&T> {
    if collection.is_empty() {
        None
    } else {
        let index = random % collection.len();

        collection.get(index)
    }
}
