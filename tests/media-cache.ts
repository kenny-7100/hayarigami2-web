import { loadMedia, mediaUrl } from "../src/game/media";

const originalFetch = window.fetch;
const results: string[] = [];
const counts = new Map<string, number>();
let fail = true;
window.fetch = async (input, init) => {
  const url = String(input);
  counts.set(url, (counts.get(url) ?? 0) + 1);
  if (url.includes("qa-retry") && fail) throw new TypeError("Injected network failure");
  if (url.includes("qa-broken")) return new Response("invalid image", { headers: { "Content-Type": "image/png" } });
  return originalFetch(input, init);
};
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
  results.push(message);
}
try {
  const file = "../tests/animation-white.svg?qa-dedup";
  const [a, b] = await Promise.all([loadMedia({ file, kind: "image" }), loadMedia({ file, kind: "image" })]);
  check(a === b && counts.get(`/game/${file}`) === 1, "Concurrent image requests share a single download");
  check(a.image?.complete && a.image.naturalWidth > 0 && mediaUrl(file).startsWith("blob:"), "Published image is decoded and uses a local blob");
  await loadMedia({ file, kind: "image" });
  check(counts.get(`/game/${file}`) === 1, "Cache hit does not request the network again");
  const retry = "../tests/animation-white.svg?qa-retry";
  await loadMedia({ file: retry, kind: "image" }).then(() => { throw new Error("Failure was hidden"); }, () => undefined);
  fail = false;
  check((await loadMedia({ file: retry, kind: "image" })).image?.complete && counts.get(`/game/${retry}`) === 2, "Failed downloads are retried successfully");
  for (let i = 0; i < 2; i++)
    await loadMedia({ file: "qa-broken.png", kind: "image" }).then(() => { throw new Error("Decode failure was hidden"); }, () => undefined);
  check(counts.get("/game/qa-broken.png") === 2, "Invalid image bytes never become a successful cache entry");
  const audio = await loadMedia({ file: "bgm-9.m4a?qa-audio", kind: "audio" });
  check(audio.url.startsWith("blob:") && audio.bytes > 0, "Audio is downloaded and passes canplaythrough before publication");
  document.querySelector("#result")!.textContent = JSON.stringify({ passed: results.length, results }, null, 2);
} catch (error) {
  document.querySelector("#result")!.textContent = JSON.stringify({ passed: results.length, error: String(error), results }, null, 2);
  throw error;
} finally {
  window.fetch = originalFetch;
}
