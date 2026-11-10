const DATABASE_NAME = "namma-macha-fm";
const DATABASE_VERSION = 1;
const SHOW_STORE = "shows";
const LATEST_SHOW_KEY = "latest";

export type LatestShow = {
  audio: Blob;
  createdAt: number;
  title: string;
};

function openShowDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SHOW_STORE)) {
        request.result.createObjectStore(SHOW_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local show storage."));
    request.onblocked = () => reject(new Error("Local show storage is busy in another tab."));
  });
}

export async function saveLatestShow(audio: Blob, title: string): Promise<void> {
  const database = await openShowDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SHOW_STORE, "readwrite");
      transaction.objectStore(SHOW_STORE).put(
        { audio, createdAt: Date.now(), title: title.trim() || "The latest broadcast" } satisfies LatestShow,
        LATEST_SHOW_KEY,
      );
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the latest show."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Saving the latest show was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function loadLatestShow(): Promise<LatestShow | null> {
  const database = await openShowDatabase();

  try {
    return await new Promise<LatestShow | null>((resolve, reject) => {
      const request = database.transaction(SHOW_STORE, "readonly")
        .objectStore(SHOW_STORE)
        .get(LATEST_SHOW_KEY);

      request.onsuccess = () => {
        const value: unknown = request.result;
        if (
          typeof value === "object" &&
          value !== null &&
          "audio" in value &&
          value.audio instanceof Blob &&
          "createdAt" in value &&
          typeof value.createdAt === "number" &&
          "title" in value &&
          typeof value.title === "string"
        ) {
          resolve({ audio: value.audio, createdAt: value.createdAt, title: value.title });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error ?? new Error("Could not load the latest show."));
    });
  } finally {
    database.close();
  }
}

export async function createContinuousShowAudio(parts: Blob[]): Promise<Blob> {
  if (parts.length === 0) {
    throw new Error("Add at least one audio segment to build a show.");
  }

  const audioContext = new AudioContext();

  try {
    const decoded = await Promise.all(
      parts.map(async (part) => audioContext.decodeAudioData(await part.arrayBuffer())),
    );
    const channelCount = Math.max(...decoded.map((buffer) => buffer.numberOfChannels));
    const totalFrames = decoded.reduce((sum, buffer) => sum + buffer.length, 0);
    const channels = Array.from({ length: channelCount }, () => new Float32Array(totalFrames));
    let frameOffset = 0;

    for (const buffer of decoded) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        const sourceChannel = buffer.getChannelData(
          buffer.numberOfChannels === 1 ? 0 : Math.min(channel, buffer.numberOfChannels - 1),
        );
        channels[channel].set(sourceChannel, frameOffset);
      }
      frameOffset += buffer.length;
    }

    const bytesPerSample = 2;
    const blockAlign = channelCount * bytesPerSample;
    const dataSize = totalFrames * blockAlign;
    const wav = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wav);
    const writeText = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };

    writeText(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, audioContext.sampleRate, true);
    view.setUint32(28, audioContext.sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, dataSize, true);

    let sampleOffset = 44;
    for (let frame = 0; frame < totalFrames; frame += 1) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
        view.setInt16(sampleOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        sampleOffset += bytesPerSample;
      }
    }

    return new Blob([wav], { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}
