export function fileFromDataTransferItems(items: DataTransferItem[]): File | undefined {
    return items.reduce<File | undefined>((res, item) => {
        if (item.kind === "file") {
            return item.getAsFile() || undefined;
        }
        return res;
    }, undefined);
}
