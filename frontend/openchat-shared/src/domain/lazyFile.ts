export class LazyFile {
    private _realFile: File | null = null;
    private _assetUrl: string | null = null;
    private _name: string = "";
    private _type: string = "";
    private _size: number = 0;

    // Constructor for in-app (asset URL)
    static fromUrl(assetUrl: string, name: string, type: string, size: number): LazyFile {
        const lazy = new LazyFile();
        lazy._assetUrl = assetUrl;
        lazy._name = name;
        lazy._type = type;
        lazy._size = size;
        return lazy;
    }

    // Constructor for system dialog (real File)
    static fromFile(file: File): LazyFile {
        const lazy = new LazyFile();
        lazy._realFile = file;
        lazy._name = file.name;
        lazy._type = file.type;
        lazy._size = file.size;
        return lazy;
    }

    // Lazy load: Fetch/create the real File if needed
    async load(): Promise<File> {
        if (!this._realFile) {
            if (this._assetUrl) {
                const response = await fetch(this._assetUrl);
                // Force the bytes fully into the JS heap by reading into an
                // ArrayBuffer rather than a Blob. On Tauri Android, a Blob
                // from the asset-protocol fetch can stay lazily backed by
                // the underlying file — and a File constructed from it
                // inherits that laziness. Downstream, createImageBitmap
                // parses just enough to know dimensions, then the first
                // drawImage from that bitmap stalls for seconds while the
                // remaining pixels are realised. Reading into an
                // ArrayBuffer here pays the read once, eagerly.
                const bytes = await response.arrayBuffer();
                this._realFile = new File([bytes], this._name, { type: this._type });
            } else {
                throw new Error("No file or URL to load from");
            }
        }
        return this._realFile;
    }

    // Proxy properties to mimic File
    get name(): string {
        return this._name;
    }
    get type(): string {
        return this._type;
    }
    get size(): number {
        return this._size;
    }
    get lastModified(): number {
        return this._realFile?.lastModified ?? Date.now();
    }

    // Add other methods as needed, e.g.,
    async arrayBuffer(): Promise<ArrayBuffer> {
        const file = await this.load();
        return file.arrayBuffer();
    }
}
