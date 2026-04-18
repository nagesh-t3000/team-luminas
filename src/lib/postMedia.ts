import type { SkillPostMediaItem } from "@/lib/skillPosts";

export const MAX_POST_MEDIA_ITEMS = 4;

const MAX_POST_IMAGE_DIMENSION = 1600;
const MAX_POST_IMAGE_DATA_URL_LENGTH = 450_000;
const MAX_POST_VIDEO_DATA_URL_LENGTH = 4_000_000;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result) {
        reject(new Error("Unable to read the selected file."));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the selected image."));
    };

    image.src = objectUrl;
  });
}

async function fileToOptimizedImageDataUrl(file: File) {
  const image = await loadImageFromFile(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const scale = Math.min(1, MAX_POST_IMAGE_DIMENSION / longestSide);
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to process the selected image.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.84);

  if (!dataUrl) {
    throw new Error("Unable to process the selected image.");
  }

  if (dataUrl.length > MAX_POST_IMAGE_DATA_URL_LENGTH) {
    throw new Error("Selected image is too large to attach. Choose a smaller image.");
  }

  return dataUrl;
}

async function fileToVideoDataUrl(file: File) {
  const dataUrl = await readFileAsDataUrl(file);

  if (dataUrl.length > MAX_POST_VIDEO_DATA_URL_LENGTH) {
    throw new Error("Selected video is too large to attach. Choose a shorter or smaller video.");
  }

  return dataUrl;
}

async function fileToSkillPostMediaItem(file: File): Promise<SkillPostMediaItem> {
  if (file.type.startsWith("image/")) {
    return {
      kind: "image",
      url: await fileToOptimizedImageDataUrl(file),
    };
  }

  if (file.type.startsWith("video/")) {
    return {
      kind: "video",
      url: await fileToVideoDataUrl(file),
    };
  }

  throw new Error("Only image and video files can be attached to a post.");
}

export async function filesToSkillPostMediaItems(files: File[]) {
  const mediaItems: SkillPostMediaItem[] = [];

  for (const file of files) {
    mediaItems.push(await fileToSkillPostMediaItem(file));
  }

  return mediaItems;
}
