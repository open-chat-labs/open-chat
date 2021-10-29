use crate::BlobStorage;
use ic_certified_map::{labeled, labeled_hash, AsHashTree, Hash, RbTree};
use serde::Serialize;
use types::HeaderField;

const LABEL_BLOBS: &[u8] = b"blobs";

#[derive(Default)]
pub struct BlobHashes(RbTree<Vec<u8>, Hash>);

impl From<&BlobStorage> for BlobHashes {
    fn from(blob_storage: &BlobStorage) -> Self {
        let mut hashes = Self::default();
        for (blob_id, blob) in blob_storage.blobs.iter() {
            hashes.insert(*blob_id, blob.hash());
        }
        hashes.update_root_hash();
        hashes
    }
}

impl BlobHashes {
    pub fn make_certificate_header(&self, blob_id: u128) -> HeaderField {
        let certificate = ic_cdk::api::data_certificate().unwrap_or_else(|| {
            panic!("data certificate is only available in query calls");
        });
        let witness = self.0.witness(&blob_id.to_be_bytes());
        let tree = labeled(LABEL_BLOBS, witness);
        let mut serializer = serde_cbor::ser::Serializer::new(vec![]);
        serializer.self_describe().unwrap();
        tree.serialize(&mut serializer).unwrap_or_else(|e| {
            panic!("failed to serialize a hash tree: {}", e);
        });
        let name = "IC-Certificate".to_owned();
        let value = format!(
            "certificate=:{}:, tree=:{}:",
            base64::encode(&certificate),
            base64::encode(&serializer.into_inner())
        );

        HeaderField(name, value)
    }

    pub fn insert(&mut self, blob_id: u128, hash: Hash) {
        self.0.insert(blob_id.to_be_bytes().to_vec(), hash);
    }

    pub fn delete(&mut self, blob_id: u128) {
        self.0.delete(&blob_id.to_be_bytes().to_vec());
    }

    pub fn update_root_hash(&self) {
        let prefixed_root_hash = &labeled_hash(LABEL_BLOBS, &self.0.root_hash());
        ic_cdk::api::set_certified_data(&prefixed_root_hash[..]);
    }
}
