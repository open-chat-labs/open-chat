# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Model-version lapse: embedding model upgrades announce a 90-day re-verification window and purge superseded embeddings ([#9072](https://github.com/open-chat-labs/open-chat/issues/9072))

- Real inference pipeline: SCRFD-500M detection + keypoints, pose-challenge verification, ArcFace alignment, w600k_mbf embeddings; models chunk-uploaded and activated by hash-pinned `commit_model` ([#9072](https://github.com/open-chat-labs/open-chat/issues/9072))
- Initial skeleton: verification sessions, pose challenges, chunked frame upload, deterministic test-mode engine, embedding store + uniqueness scan, proof notification to user_index ([#9072](https://github.com/open-chat-labs/open-chat/issues/9072))
