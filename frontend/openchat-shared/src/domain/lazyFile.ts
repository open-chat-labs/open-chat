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
                const blob = await response.blob();
                this._realFile = new File([blob], this._name, { type: this._type });
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
