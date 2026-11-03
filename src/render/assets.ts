function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image ${url}`));
    img.src = url;
  });
}

export class AssetCache {
  private images = new Map<string, Promise<HTMLImageElement>>();
  private blobUrls = new Map<string, string>();

  getImage(url: string): Promise<HTMLImageElement> {
    let p = this.images.get(url);
    if (!p) {
      p = loadImage(url).catch((e) => {
        this.images.delete(url);
        throw e;
      });
      this.images.set(url, p);
    }
    return p;
  }

  /** Load an image from a blob, cached by key. Re-registering a key with a new blob replaces it. */
  getBlobImage(key: string, blob: Blob): Promise<HTMLImageElement> {
    const cacheKey = `blob:${key}`;
    const existing = this.images.get(cacheKey);
    if (existing && this.blobUrls.get(key)) return existing;
    const url = URL.createObjectURL(blob);
    this.blobUrls.set(key, url);
    const p = loadImage(url).catch((e) => {
      this.images.delete(cacheKey);
      throw e;
    });
    this.images.set(cacheKey, p);
    return p;
  }

  dropBlob(key: string): void {
    const url = this.blobUrls.get(key);
    if (url) URL.revokeObjectURL(url);
    this.blobUrls.delete(key);
    this.images.delete(`blob:${key}`);
  }
}
