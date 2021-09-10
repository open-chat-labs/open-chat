import type { BlobReference, MessageContent } from "../../domain/chat/chat";
import type { IDataClient } from "./data.client.interface";

export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

export class DataClientMock implements IDataClient {
    async getData(blobRef: BlobReference): Promise<Uint8Array | undefined> {
        return new Promise((resolve) => {
            let url = "";
            switch (blobRef.blobId) {
                case BigInt(0):
                    url =
                        // "https://natureconservancy-h.assetsadobe.com/is/image/content/dam/tnc/nature/en/photos/australia/Quokka_Sam-West.jpg?crop=0,886,2365,1773&wid=640&hei=480&scl=3.6953125";
                        "https://file-examples-com.github.io/uploads/2017/10/file_example_PNG_1MB.png";
                    break;
                case BigInt(1):
                    url =
                        "https://file-examples-com.github.io/uploads/2017/04/file_example_MP4_640_3MG.mp4";
                    break;
                case BigInt(2):
                    url =
                        "https://file-examples-com.github.io/uploads/2017/10/file-example_PDF_500_kB.pdf";
                    break;
                case BigInt(3):
                    url =
                        "https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_1MG.mp3";
                    break;
            }

            setTimeout(() => {
                fetch(url)
                    .then((resp) => resp.arrayBuffer())
                    .then((bytes) => resolve(new Uint8Array(bytes)));
            }, 1000);
        });
    }
    async uploadData(_content: MessageContent): Promise<boolean> {
        return Promise.resolve(true);
    }
}
