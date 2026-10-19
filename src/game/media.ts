import type { MediaFile } from "./media-plan";

type Resource = { url: string; image?: HTMLImageElement; bytes: number };
const cache = new Map<string, { promise: Promise<Resource>; value?: Resource }>();
let protectedFiles = new Set<string>();
const budget = 96 * 1024 * 1024;
export const mediaUrl = (file: string) => cache.get(file)?.value?.url ?? `${import.meta.env.BASE_URL}game/${file}`;

export function protectMedia(files: MediaFile[]) {
  protectedFiles = new Set(files.map(item => item.file));
  trimCache();
}

function trimCache() {
  let bytes = [...cache.values()].reduce((total, entry) => total + (entry.value?.bytes ?? 0), 0);
  for (const [file, entry] of cache) {
    if (bytes <= budget) break;
    if (!entry.value || protectedFiles.has(file)) continue;
    bytes -= entry.value.bytes;
    URL.revokeObjectURL(entry.value.url);
    cache.delete(file);
  }
}

export function loadMedia({ file, kind }: MediaFile): Promise<Resource> {
  const existing = cache.get(file);
  if (existing) {
    cache.delete(file);
    cache.set(file, existing);
    return existing.promise;
  }
  const entry: { promise: Promise<Resource>; value?: Resource } = { promise: Promise.resolve(null!) };
  entry.promise = Promise.resolve().then(async () => {
    let url: string | undefined;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}game/${file}`, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      url = URL.createObjectURL(blob);
      let image: HTMLImageElement | undefined;
      if (kind === "image") {
        image = new Image();
        image.src = url;
        await image.decode();
      } else {
        // Validate and buffer the complete local blob before publishing the page.
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio();
          const finish = (error?: Error) => {
            clearTimeout(timer);
            audio.oncanplaythrough = audio.onerror = null;
            audio.removeAttribute("src");
            audio.load();
            if (error) reject(error); else resolve();
          };
          const timer = setTimeout(() => finish(new Error("Audio decode timeout")), 15000);
          audio.oncanplaythrough = () => finish();
          audio.onerror = () => finish(new Error("Audio decode failed"));
          audio.preload = "auto";
          audio.src = url!;
          audio.load();
        });
      }
      const value = { url, image, bytes: blob.size + (image ? image.naturalWidth * image.naturalHeight * 4 : 0) };
      entry.value = value;
      trimCache();
      return value;
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      cache.delete(file);
      throw new Error(`资源加载失败：${file}（${error instanceof Error ? error.message : String(error)}）`, { cause: error });
    }
  });
  cache.set(file, entry);
  return entry.promise;
}

export async function prepareMedia(files: MediaFile[], current: () => boolean = () => true) {
  // Small batches leave room for foreground requests and avoid flooding mobile connections.
  for (let i = 0; i < files.length && current(); i += 4)
    await Promise.all(files.slice(i, i + 4).map(loadMedia));
}

export async function decodedImage(file: string) {
  return (await loadMedia({ file, kind: "image" })).image!;
}
