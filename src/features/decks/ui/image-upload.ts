"use client";

import { MAX_IMAGE_BYTES } from "@/features/decks/image";

export { MAX_IMAGE_BYTES };

export function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("That image could not be opened."));
    img.src = src;
  });
}

/** Screenshot of the product: any PNG, JPG or WebP under the size limit. */
export async function readScreenshot(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use a PNG, JPG or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large (max 450 KB). Export a smaller screenshot.");
  return readDataUrl(file);
}

/** Logo: a square PNG, at least 256 px. SVG is not accepted (it can carry script). */
export async function readLogo(file: File): Promise<string> {
  if (file.type !== "image/png") throw new Error("Use a PNG logo.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Logo is too large (max 450 KB).");
  const src = await readDataUrl(file);
  const { width, height } = await imageSize(src);
  if (Math.abs(width - height) > Math.max(2, width * 0.02)) throw new Error("The logo must be square.");
  if (width < 256) throw new Error("The logo must be at least 256 px wide.");
  return src;
}
