import { parseProject } from '../document'
import type { CanvasArtProject } from '../document'

export const DB_NAME = 'canvasart-local'
export const DB_STORE = 'projects'
export const AUTOSAVE_ID = 'autosave'

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveLocal(value: CanvasArtProject): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(value, AUTOSAVE_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function readLocal(): Promise<CanvasArtProject | undefined> {
  const db = await openDatabase()
  const value = await new Promise<CanvasArtProject | undefined>((resolve, reject) => {
    const request = db.transaction(DB_STORE).objectStore(DB_STORE).get(AUTOSAVE_ID)
    request.onsuccess = () => {
      try {
        resolve(request.result ? parseProject(request.result) : undefined)
      } catch (error) {
        reject(error)
      }
    }
    request.onerror = () => reject(request.error)
  })
  db.close()
  return value
}
