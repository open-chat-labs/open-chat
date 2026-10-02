use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyPrefix, ProfileDocumentKey, ProfileDocumentKeyPrefix, ProfileDocumentType, with_map, with_map_mut};
use types::{Document, TimestampMillis};

// The user's avatar or profile background. The document is stored in the main stable memory map,
// and only its id is held on the heap, since that is all most callers need.
#[derive(Serialize, Deserialize, Default)]
pub struct ProfileDocument {
    #[serde(rename = "i", default, skip_serializing_if = "Option::is_none")]
    id: Option<u128>,
    // When the document was last set. This field was previously the timestamp of the `Timestamped`.
    #[serde(rename = "t")]
    last_updated: TimestampMillis,
}

impl ProfileDocument {
    pub fn id(&self) -> Option<u128> {
        self.id
    }

    // Returns the document's id if the document has been set since `since`
    pub fn id_if_set_after(&self, since: TimestampMillis) -> Option<Option<u128>> {
        (self.last_updated > since).then_some(self.id)
    }

    pub fn get(&self, document_type: ProfileDocumentType) -> Option<Document> {
        // Avoid reading from stable memory if there is no document
        self.id?;
        with_map(|m| m.get(key(document_type))).map(|bytes| msgpack::deserialize_then_unwrap(&bytes))
    }

    pub fn set(&mut self, document_type: ProfileDocumentType, document: Option<Document>, now: TimestampMillis) {
        self.id = document.as_ref().map(|d| d.id);
        self.last_updated = now;

        if let Some(document) = document {
            with_map_mut(|m| m.insert(key(document_type), msgpack::serialize_then_unwrap(&document)));
        } else {
            with_map_mut(|m| m.remove(key(document_type)));
        }
    }
}

fn key(document_type: ProfileDocumentType) -> ProfileDocumentKey {
    ProfileDocumentKeyPrefix::new().create_key(&document_type)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn documents_can_be_set_and_removed() {
        init_stable_memory_map();
        let mut avatar = ProfileDocument::default();
        let mut profile_background = ProfileDocument::default();
        assert!(avatar.id().is_none());
        assert!(avatar.get(ProfileDocumentType::Avatar).is_none());
        assert!(avatar.id_if_set_after(0).is_none());

        avatar.set(ProfileDocumentType::Avatar, Some(document(1, 1000)), 10);
        profile_background.set(ProfileDocumentType::ProfileBackground, Some(document(2, 1024 * 1024)), 20);
        assert_eq!(avatar.id(), Some(1));
        assert_documents_eq(avatar.get(ProfileDocumentType::Avatar), Some(document(1, 1000)));
        assert_eq!(profile_background.id(), Some(2));
        assert_documents_eq(
            profile_background.get(ProfileDocumentType::ProfileBackground),
            Some(document(2, 1024 * 1024)),
        );
        assert_eq!(avatar.id_if_set_after(9), Some(Some(1)));
        assert!(avatar.id_if_set_after(10).is_none());

        // Replacing the avatar doesn't affect the profile background
        avatar.set(ProfileDocumentType::Avatar, Some(document(3, 500)), 30);
        assert_documents_eq(avatar.get(ProfileDocumentType::Avatar), Some(document(3, 500)));
        assert_eq!(avatar.id_if_set_after(20), Some(Some(3)));

        avatar.set(ProfileDocumentType::Avatar, None, 40);
        assert!(avatar.id().is_none());
        assert!(avatar.get(ProfileDocumentType::Avatar).is_none());
        assert!(with_map(|m| m.get(key(ProfileDocumentType::Avatar))).is_none());
        assert_eq!(avatar.id_if_set_after(30), Some(None));
        assert_documents_eq(
            profile_background.get(ProfileDocumentType::ProfileBackground),
            Some(document(2, 1024 * 1024)),
        );
    }

    fn document(id: u128, len: usize) -> Document {
        Document {
            id,
            mime_type: "image/png".to_string(),
            data: vec![id as u8; len],
        }
    }

    fn assert_documents_eq(actual: Option<Document>, expected: Option<Document>) {
        let fields = |d: Option<Document>| d.map(|d| (d.id, d.mime_type, d.data));
        assert_eq!(fields(actual), fields(expected));
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
