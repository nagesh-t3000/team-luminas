import type { FaceDetector } from "@mediapipe/tasks-vision";

const TASKS_VISION_VERSION = "0.10.34";
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const FACE_MODEL_ASSET =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

let detectorPromise: Promise<FaceDetector> | null = null;

export async function getFaceDetector() {
  if (!detectorPromise) {
    detectorPromise = import("@mediapipe/tasks-vision").then(
      async ({ FaceDetector, FilesetResolver }) => {
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);

        return FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_MODEL_ASSET,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.6,
        });
      },
    );
  }

  return detectorPromise;
}
