"use client";

interface StoredSharedFile {
  blob: Blob;
  createdAt: number;
  direction: "incoming" | "outgoing";
  fileId: string;
  mime: string;
  name: string;
  roomId: string;
  size: number;
}

const DB_NAME = "meet37-file-shares";
const DB_VERSION = 1;
const STORE_NAME = "files";

function storageKey(roomId: string, fileId: string) {
  return `${roomId}:${fileId}`;
}

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("error.persistentFileStorageUnavailable")
    );
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "key"
        });
        store.createIndex("roomId", "roomId");
      }
    };
    request.onerror = () =>
      reject(request.error ?? new Error("error.couldNotOpenFileStorage"));
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  const database = await openDatabase();

  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);
    let result: T | undefined;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function savePersistentSharedFile(
  roomId: string,
  fileId: string,
  file: Blob,
  name: string,
  mime: string,
  direction: "incoming" | "outgoing"
) {
  await withStore("readwrite", (store) =>
    store.put({
      blob: file,
      createdAt: Date.now(),
      direction,
      fileId,
      key: storageKey(roomId, fileId),
      mime,
      name,
      roomId,
      size: file.size
    })
  ).catch(() => undefined);
}

export async function listPersistentSharedFiles(roomId: string) {
  const database = await openDatabase().catch(() => null);

  if (!database) {
    return [];
  }

  return new Promise<StoredSharedFile[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("roomId");
    const request = index.getAll(roomId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(
        (request.result as Array<StoredSharedFile & { key: string }>).map(
          ({ key: _key, ...file }) => file
        )
      );
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  }).catch(() => []);
}
