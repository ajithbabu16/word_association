import { useState, useEffect, useCallback } from 'react';

export interface UploadedImageItem {
  name: string;
  url: string;
  dataUrl?: string;
  file?: File;
  timestamp: number;
}

export interface ImageResolution {
  found: boolean;
  url: string | null;
  filename: string | null;
  source: 'uploaded' | 'server' | 'none';
}

const toTitle = (s: string) =>
  s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// In-memory global store
let globalServerImages: string[] = [];
let globalUploadedImages: Map<string, UploadedImageItem> = new Map();
let isStoreInitialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('association-images-updated'));
  }
}

// Generate candidates for matching a category or word
export function getCandidateFilenames(term: string): string[] {
  if (!term) return [];
  const clean = term.trim();
  if (!clean) return [];

  const title = toTitle(clean);
  const upper = clean.toUpperCase();
  const lower = clean.toLowerCase();
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  const noSpace = clean.replace(/\s+/g, '');
  const snake = clean.replace(/\s+/g, '_');
  const kebab = clean.replace(/\s+/g, '-');
  const alphanumeric = clean.replace(/[^a-zA-Z0-9]/g, '');

  const baseNames = new Set([
    clean,
    title,
    capitalized,
    upper,
    lower,
    noSpace,
    snake,
    kebab,
    alphanumeric
  ]);

  // Add singular / plural variants
  if (clean.toLowerCase().endsWith('s') && clean.length > 3) {
    const singular = clean.slice(0, -1);
    baseNames.add(toTitle(singular));
    baseNames.add(singular);
  }

  const extensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.PNG', '.JPG'];
  const candidates: string[] = [];

  for (const base of baseNames) {
    for (const ext of extensions) {
      candidates.push(\\);
    }
  }

  return [...new Set(candidates)];
}

export const imageStore = {
  getServerImages(): string[] {
    return globalServerImages;
  },

  getUploadedImages(): Map<string, UploadedImageItem> {
    return globalUploadedImages;
  },

  async init(): Promise<void> {
    if (isStoreInitialized && globalServerImages.length > 0) return;
    try {
      const res = await fetch('/existing_images.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          globalServerImages = data;
          isStoreInitialized = true;
          notifyListeners();
        }
      }
    } catch (e) {
      console.warn('[imageStore] Failed to load existing_images.json:', e);
    }
  },

  resolveImage(category?: string, word?: string): ImageResolution {
    const terms = [category, word].filter(Boolean) as string[];

    for (const term of terms) {
      const candidates = getCandidateFilenames(term);

      // 1. Check uploaded images first
      for (const cand of candidates) {
        const key = cand.toLowerCase();
        if (globalUploadedImages.has(key)) {
          const item = globalUploadedImages.get(key)!;
          return {
            found: true,
            url: item.url,
            filename: item.name,
            source: 'uploaded'
          };
        }
      }

      // Check uploaded images by fuzzy stripped name
      const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      for (const [key, item] of globalUploadedImages.entries()) {
        const itemClean = item.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (itemClean === cleanTerm) {
          return {
            found: true,
            url: item.url,
            filename: item.name,
            source: 'uploaded'
          };
        }
      }

      // 2. Check server images
      const serverLowerMap = new Map<string, string>();
      for (const s of globalServerImages) {
        serverLowerMap.set(s.toLowerCase(), s);
      }

      for (const cand of candidates) {
        const key = cand.toLowerCase();
        if (serverLowerMap.has(key)) {
          const actualName = serverLowerMap.get(key)!;
          return {
            found: true,
            url: \/puzzle_image/\,
            filename: actualName,
            source: 'server'
          };
        }
      }

      // Check server images by fuzzy stripped name
      for (const s of globalServerImages) {
        const sClean = s.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (sClean === cleanTerm) {
          return {
            found: true,
            url: \/puzzle_image/\,
            filename: s,
            source: 'server'
          };
        }
      }
    }

    return {
      found: false,
      url: null,
      filename: null,
      source: 'none'
    };
  },

  hasImage(category?: string, word?: string): boolean {
    return this.resolveImage(category, word).found;
  },

  async uploadImages(files: FileList | File[]): Promise<{ count: number; savedServer: boolean }> {
    const fileArray = Array.from(files).filter(f => /\.(png|jpg|jpeg|webp|svg)$/i.test(f.name));
    if (fileArray.length === 0) return { count: 0, savedServer: false };

    const payloadFiles: Array<{ name: string; data: string }> = [];

    for (const file of fileArray) {
      const url = URL.createObjectURL(file);
      const key = file.name.toLowerCase();
      const item: UploadedImageItem = {
        name: file.name,
        url,
        file,
        timestamp: Date.now()
      };

      globalUploadedImages.set(key, item);
      if (!globalServerImages.includes(file.name)) {
        globalServerImages.push(file.name);
      }

      // Read as base64 for server sync
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        item.dataUrl = dataUrl;
        payloadFiles.push({ name: file.name, data: dataUrl });
      } catch (err) {
        console.warn('[imageStore] Base64 read skipped for', file.name);
      }
    }

    notifyListeners();

    // Persist to server via /api/upload-images
    let savedServer = false;
    if (payloadFiles.length > 0) {
      try {
        const res = await fetch('/api/upload-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: payloadFiles })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) savedServer = true;
        }
      } catch (err) {
        console.info('[imageStore] Server sync endpoint not available, stored in client session.');
      }
    }

    return { count: fileArray.length, savedServer };
  }
};

export function useImageStore() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setVersion(v => v + 1);
    listeners.add(handleUpdate);
    window.addEventListener('association-images-updated', handleUpdate);

    if (!isStoreInitialized) {
      imageStore.init();
    }

    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener('association-images-updated', handleUpdate);
    };
  }, []);

  return {
    serverImages: globalServerImages,
    uploadedImages: globalUploadedImages,
    resolveImage: useCallback((c?: string, w?: string) => imageStore.resolveImage(c, w), []),
    hasImage: useCallback((c?: string, w?: string) => imageStore.hasImage(c, w), []),
    uploadImages: useCallback((files: FileList | File[]) => imageStore.uploadImages(files), [])
  };
}
