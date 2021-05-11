import { Option } from "../domain/model/common";

export function dataToBlobUrl(data: ArrayBuffer, type: Option<string>): string {
    const options = type ? { type } : undefined;
    const blob = new Blob([data], options);
    return URL.createObjectURL(blob);
}