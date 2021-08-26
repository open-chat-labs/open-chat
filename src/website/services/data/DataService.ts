import async from "async";
import { Option } from "../../domain/model/common";
import getChunk from "./getChunk";
import { CHUNK_SIZE_BYTES } from "../../constants";
import putChunk from "./putChunk";

export class DataService {
  public async getData(
    key: string,
    totalBytes?: number,
    chunkSize?: number
  ): Promise<Option<Uint8Array>> {
    if (!totalBytes || !chunkSize) {
      const response = await getChunk(key, 0);
      switch (response.kind) {
        case "notFound":
          return null;
        case "success":
          return response.data;
      }
    }

    const bytes = new Uint8Array(totalBytes);
    const chunks = this.getChunkIndexes(totalBytes, chunkSize);

    try {
      await async.mapLimit(chunks, 10, async (i, callback) => {
        const response = await getChunk(key, i);
        if (response.kind === "success") {
          const offset = i * chunkSize;
          bytes.set(response.data, offset);
          callback(null);
        } else {
          callback({
            name: "getDataFailed",
            message: response.kind,
          });
        }
      });
    } catch (e) {
      console.log(e);
      return null;
    }

    return bytes;
  }

  public async putData(
    key: string,
    data: Uint8Array,
    unchunked?: boolean
  ): Promise<boolean> {
    if (unchunked) {
      await putChunk(key, 0, data);
      return true;
    }

    const size = data.byteLength;
    const chunks = [];
    for (let byteStart = 0; byteStart < size; byteStart += CHUNK_SIZE_BYTES) {
      const byteEnd = Math.min(size, byteStart + CHUNK_SIZE_BYTES);
      const slice = data.slice(byteStart, byteEnd);
      chunks.push(slice);
    }

    await async.forEachOfLimit(chunks, 10, async (c, i, callback) => {
      const index = i as number;
      await putChunk(key, index, c);
      callback(null);
    });

    return true;
  }

  private getChunkIndexes(totalBytes: number, chunkSize: number): number[] {
    const chunks = [];
    let index = 0;
    for (let bytes = 0; bytes < totalBytes; bytes += chunkSize) {
      chunks.push(index++);
    }
    return chunks;
  }
}
