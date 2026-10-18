import { validateSave } from "./engine";
import type { GameData, GameState } from "./engine";
export type SaveSlot = { id: string; savedAt: string; state: GameState };
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("hayarigami2-web", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("saves", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("无法打开本地存档空间"));
    request.onblocked = () =>
      reject(new Error("存档空间被其他页面占用，请关闭旧页面后重试"));
  });
}
export async function readSaves(): Promise<SaveSlot[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("saves", "readonly");
      const req = tx.objectStore("saves").getAll();
      tx.oncomplete = () => resolve(req.result as SaveSlot[]);
      tx.onerror = () => reject(new Error("读取存档失败"));
      tx.onabort = () => reject(new Error("读取存档被中断"));
    });
  } finally {
    db.close();
  }
}
let writes: Promise<void> = Promise.resolve();
export function saveGame(id: string, state: GameState): Promise<void> {
  const slot: SaveSlot = {
    id,
    savedAt: new Date().toISOString(),
    state: structuredClone(state),
  };
  const task = writes
    .catch(() => undefined)
    .then(async () => {
      const db = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("saves", "readwrite");
          tx.objectStore("saves").put(slot);
          tx.oncomplete = () => resolve();
          tx.onerror = () =>
            reject(new Error("保存失败：本地空间不足或被浏览器禁用"));
          tx.onabort = () => reject(new Error("保存被中断，请重试"));
        });
      } finally {
        db.close();
      }
    });
  writes = task;
  return task;
}
export async function loadGame(data: GameData, id: string): Promise<GameState> {
  await writes.catch(() => undefined);
  const slot = (await readSaves()).find((s) => s.id === id);
  if (!slot) throw new Error("没有找到这个存档");
  return validateSave(data, slot.state);
}
