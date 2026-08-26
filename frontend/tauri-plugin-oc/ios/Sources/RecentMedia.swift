import Foundation
import Photos
import Tauri
import UIKit
import UniformTypeIdentifiers

class LoadMediaArgs: Decodable {
    let count: Int?
    let offset: Int?
}

class ExportMediaArgs: Decodable {
    let uri: String?
}

// Recent camera-roll media for the attachment strip, mirroring the Android
// LoadRecentMedia response shape:
//   { permission: "granted" | "denied", media: [{ uri, filename, mimeType,
//     dateAdded, isVideo, filePath, size, thumbnail }] }
//
// Photos assets have no readable file path, so `filePath` is empty in the list
// and `uri` carries the PHAsset local identifier; the frontend calls the
// exportMedia command with that uri when an item is picked, which materialises
// the asset into a temp file the webview can read via the asset protocol.
class RecentMedia {

    func handleLoad(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(LoadMediaArgs.self)
        let count = args.count ?? 50
        let offset = args.offset ?? 0

        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        switch status {
        case .authorized, .limited:
            load(invoke, count: count, offset: offset)
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { [weak self] newStatus in
                if newStatus == .authorized || newStatus == .limited {
                    self?.load(invoke, count: count, offset: offset)
                } else {
                    invoke.resolve(["permission": "denied", "media": [Any]()])
                }
            }
        default:
            invoke.resolve(["permission": "denied", "media": [Any]()])
        }
    }

    private func load(_ invoke: Invoke, count: Int, offset: Int) {
        DispatchQueue.global(qos: .userInitiated).async {
            let options = PHFetchOptions()
            options.predicate = NSPredicate(
                format: "mediaType == %d OR mediaType == %d",
                PHAssetMediaType.image.rawValue,
                PHAssetMediaType.video.rawValue)
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            options.fetchLimit = offset + count

            let fetchResult = PHAsset.fetchAssets(with: options)
            guard fetchResult.count > offset else {
                invoke.resolve(["permission": "granted", "media": [Any]()])
                return
            }

            let imageManager = PHImageManager.default()
            let requestOptions = PHImageRequestOptions()
            requestOptions.isSynchronous = true
            requestOptions.deliveryMode = .highQualityFormat
            requestOptions.resizeMode = .fast
            // Skip iCloud-only assets rather than block the strip on a download.
            requestOptions.isNetworkAccessAllowed = false

            var media: [[String: Any]] = []
            for index in offset..<min(fetchResult.count, offset + count) {
                let asset = fetchResult.object(at: index)
                let resource = PHAssetResource.assetResources(for: asset).first

                var thumbnail: String?
                imageManager.requestImage(
                    for: asset,
                    targetSize: CGSize(width: 256, height: 256),
                    contentMode: .aspectFill,
                    options: requestOptions
                ) { image, _ in
                    if let data = image?.jpegData(compressionQuality: 0.7) {
                        thumbnail = "data:image/jpeg;base64," + data.base64EncodedString()
                    }
                }

                let mimeType =
                    resource.flatMap { UTType($0.uniformTypeIdentifier)?.preferredMIMEType }
                    ?? (asset.mediaType == .video ? "video/mp4" : "image/jpeg")

                media.append([
                    "uri": asset.localIdentifier,
                    "filename": resource?.originalFilename ?? "unknown",
                    "mimeType": mimeType,
                    "dateAdded": Int(asset.creationDate?.timeIntervalSince1970 ?? 0),
                    "isVideo": asset.mediaType == .video,
                    "filePath": "",
                    "size": (resource?.value(forKey: "fileSize") as? Int) ?? 0,
                    "thumbnail": thumbnail as Any,
                ])
            }

            invoke.resolve(["permission": "granted", "media": media])
        }
    }

    func handleExport(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ExportMediaArgs.self)
        guard let uri = args.uri else {
            invoke.reject("EXPORT_MISSING_URI")
            return
        }

        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [uri], options: nil)
        guard let asset = fetchResult.firstObject else {
            invoke.reject("EXPORT_ASSET_NOT_FOUND")
            return
        }

        let resources = PHAssetResource.assetResources(for: asset)
        let wanted: PHAssetResourceType = asset.mediaType == .video ? .video : .photo
        guard let resource = resources.first(where: { $0.type == wanted }) ?? resources.first
        else {
            invoke.reject("EXPORT_NO_RESOURCE")
            return
        }

        let dir = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("oc_media", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            invoke.reject("EXPORT_FAILED")
            return
        }

        let fileUrl = dir.appendingPathComponent(resource.originalFilename)
        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true

        PHAssetResourceManager.default().writeData(
            for: resource, toFile: fileUrl, options: options
        ) { error in
            if error != nil {
                invoke.reject("EXPORT_FAILED")
            } else {
                invoke.resolve(["filePath": fileUrl.path])
            }
        }
    }
}
