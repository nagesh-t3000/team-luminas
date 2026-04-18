import type {
  Category,
  FaceLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { useEffect, useMemo, useRef, useState } from "react";
import { persistAuthUserWithSettings, type AuthUser } from "@/lib/appAuth";
import { createBackendFaceIdentity } from "@/lib/faceVerification";
import { getFaceLandmarker } from "@/lib/faceLandmarker";
import {
  humanVerificationMode,
  humanVerificationProvider,
} from "@/lib/humanVerification";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type HumanVerificationPageProps = {
  authUser: AuthUser;
  onVerificationCompleted: (user: AuthUser) => void;
};

type FaceCheckStatus =
  | "loading"
  | "no-face"
  | "multiple-faces"
  | "too-far"
  | "too-close"
  | "off-center"
  | "blink-needed"
  | "turn-needed"
  | "ready"
  | "error";

type LiveSignals = {
  singleFace: boolean;
  framing: boolean;
  blink: boolean;
  turn: boolean;
};

const REQUIRED_STABLE_FRAMES = 12;
const FACE_AREA_MIN = 0.12;
const FACE_AREA_MAX = 0.5;
const FACE_CENTER_X_TOLERANCE = 0.16;
const FACE_CENTER_Y_TOLERANCE = 0.18;
const BLINK_BLENDSHAPE_THRESHOLD = 0.45;
const BLINK_EAR_DROP_RATIO = 0.72;
const BLINK_EAR_RECOVERY_RATIO = 0.9;
const HEAD_TURN_RATIO_THRESHOLD = 0.07;
const FACE_SIGNATURE_MIN_SAMPLES = 4;
const ANALYSIS_INTERVAL_MS = 120;
const MIN_LIVENESS_SCORE = 0.82;
const MIN_ANTI_SPOOF_SCORE = 0.8;

const LANDMARKS = {
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeUpper: 159,
  leftEyeLower: 145,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeUpper: 386,
  rightEyeLower: 374,
  leftCheek: 234,
  rightCheek: 454,
  noseTip: 1,
  noseLeft: 98,
  noseRight: 327,
  mouthTop: 13,
  mouthLeft: 61,
  mouthRight: 291,
  forehead: 10,
  chin: 152,
} as const;

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unable to verify your humanity right now.";
}

function isMissingCompleteVerificationFunctionError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  return (
    message.includes("Could not find the function public.complete_human_verification") ||
    message.includes("schema cache")
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBlendshapeScore(categories: Category[] | undefined, name: string) {
  return categories?.find((category) => category.categoryName === name)?.score ?? 0;
}

function getDistance(first: NormalizedLandmark, second: NormalizedLandmark) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function getLandmarkBounds(landmarks: NormalizedLandmark[]) {
  const initial = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  return landmarks.reduce((bounds, landmark) => {
    bounds.minX = Math.min(bounds.minX, landmark.x);
    bounds.maxX = Math.max(bounds.maxX, landmark.x);
    bounds.minY = Math.min(bounds.minY, landmark.y);
    bounds.maxY = Math.max(bounds.maxY, landmark.y);
    return bounds;
  }, initial);
}

function getEyeAspectRatio(
  landmarks: NormalizedLandmark[],
  upperIndex: number,
  lowerIndex: number,
  outerIndex: number,
  innerIndex: number,
) {
  const upper = landmarks[upperIndex];
  const lower = landmarks[lowerIndex];
  const outer = landmarks[outerIndex];
  const inner = landmarks[innerIndex];

  if (!upper || !lower || !outer || !inner) {
    return 0;
  }

  const eyeWidth = getDistance(outer, inner);

  if (eyeWidth === 0) {
    return 0;
  }

  return getDistance(upper, lower) / eyeWidth;
}

function getAverageEyeAspectRatio(landmarks: NormalizedLandmark[]) {
  const left = getEyeAspectRatio(
    landmarks,
    LANDMARKS.leftEyeUpper,
    LANDMARKS.leftEyeLower,
    LANDMARKS.leftEyeOuter,
    LANDMARKS.leftEyeInner,
  );
  const right = getEyeAspectRatio(
    landmarks,
    LANDMARKS.rightEyeUpper,
    LANDMARKS.rightEyeLower,
    LANDMARKS.rightEyeOuter,
    LANDMARKS.rightEyeInner,
  );

  return (left + right) / 2;
}

function getHeadTurnRatio(landmarks: NormalizedLandmark[]) {
  const nose = landmarks[LANDMARKS.noseTip];
  const leftEye = landmarks[LANDMARKS.leftEyeOuter];
  const rightEye = landmarks[LANDMARKS.rightEyeOuter];

  if (!nose || !leftEye || !rightEye) {
    return 0;
  }

  const leftDistance = getDistance(nose, leftEye);
  const rightDistance = getDistance(nose, rightEye);

  if (leftDistance === 0 || rightDistance === 0) {
    return 0;
  }

  const eyeWidth = getDistance(leftEye, rightEye);
  const eyeMidpointX = (leftEye.x + rightEye.x) / 2;
  const noseOffsetRatio = eyeWidth === 0 ? 0 : Math.abs((nose.x - eyeMidpointX) / eyeWidth);

  return Math.max(Math.abs(Math.log(leftDistance / rightDistance)), noseOffsetRatio);
}

function getFaceSignatureFeatures(landmarks: NormalizedLandmark[]) {
  const nose = landmarks[LANDMARKS.noseTip];
  const leftEye = landmarks[LANDMARKS.leftEyeOuter];
  const rightEye = landmarks[LANDMARKS.rightEyeOuter];
  const mouthLeft = landmarks[LANDMARKS.mouthLeft];
  const mouthRight = landmarks[LANDMARKS.mouthRight];
  const mouthTop = landmarks[LANDMARKS.mouthTop];
  const chin = landmarks[LANDMARKS.chin];
  const forehead = landmarks[LANDMARKS.forehead];
  const leftCheek = landmarks[LANDMARKS.leftCheek];
  const rightCheek = landmarks[LANDMARKS.rightCheek];
  const noseLeft = landmarks[LANDMARKS.noseLeft];
  const noseRight = landmarks[LANDMARKS.noseRight];

  if (
    !nose ||
    !leftEye ||
    !rightEye ||
    !mouthLeft ||
    !mouthRight ||
    !mouthTop ||
    !chin ||
    !forehead ||
    !leftCheek ||
    !rightCheek ||
    !noseLeft ||
    !noseRight
  ) {
    return null;
  }

  const eyeDistance = getDistance(leftEye, rightEye);

  if (eyeDistance === 0) {
    return null;
  }

  return [
    getDistance(mouthLeft, mouthRight) / eyeDistance,
    getDistance(nose, mouthTop) / eyeDistance,
    getDistance(nose, chin) / eyeDistance,
    getDistance(forehead, chin) / eyeDistance,
    getDistance(leftCheek, rightCheek) / eyeDistance,
    getDistance(noseLeft, noseRight) / eyeDistance,
    getDistance(leftEye, mouthLeft) / eyeDistance,
    getDistance(rightEye, mouthRight) / eyeDistance,
  ];
}

function getMotionScore(samples: Array<{ x: number; y: number }>) {
  if (samples.length < 4) {
    return 0;
  }

  const xs = samples.map((sample) => sample.x);
  const ys = samples.map((sample) => sample.y);
  const horizontalSpan = Math.max(...xs) - Math.min(...xs);
  const verticalSpan = Math.max(...ys) - Math.min(...ys);

  return clamp((horizontalSpan + verticalSpan) * 10, 0, 1);
}

function assessFaceDetection(
  landmarks: NormalizedLandmark[] | undefined,
  faceCount: number,
) {
  if (faceCount > 1) {
    return {
      message: "Only one face can be in frame during verification.",
      status: "multiple-faces" as const,
      usable: false,
    };
  }

  if (!landmarks?.length) {
    return {
      message: "No face detected yet. Center your face in the camera.",
      status: "no-face" as const,
      usable: false,
    };
  }

  const bounds = getLandmarkBounds(landmarks);
  const faceAreaRatio = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  const faceCenterX = (bounds.minX + bounds.maxX) / 2;
  const faceCenterY = (bounds.minY + bounds.maxY) / 2;

  if (faceAreaRatio < FACE_AREA_MIN) {
    return {
      message: "Move a little closer so your face fills more of the frame.",
      status: "too-far" as const,
      usable: false,
    };
  }

  if (faceAreaRatio > FACE_AREA_MAX) {
    return {
      message: "Move slightly back so your full face fits in view.",
      status: "too-close" as const,
      usable: false,
    };
  }

  if (
    Math.abs(faceCenterX - 0.5) > FACE_CENTER_X_TOLERANCE ||
    Math.abs(faceCenterY - 0.5) > FACE_CENTER_Y_TOLERANCE
  ) {
    return {
      message: "Center your face inside the frame and hold still.",
      status: "off-center" as const,
      usable: false,
    };
  }

  return {
    message: "Face detected. Hold steady for a moment.",
    status: "ready" as const,
    usable: true,
  };
}

function getFaceStatusLabel(status: FaceCheckStatus) {
  switch (status) {
    case "loading":
      return "Loading detector";
    case "no-face":
      return "Looking for face";
    case "multiple-faces":
      return "One face only";
    case "too-far":
      return "Move closer";
    case "too-close":
      return "Move back";
    case "off-center":
      return "Center face";
    case "blink-needed":
      return "Blink once";
    case "turn-needed":
      return "Turn slightly";
    case "ready":
      return "Live human confirmed";
    case "error":
      return "Detector error";
  }
}

export function HumanVerificationPage({
  authUser,
  onVerificationCompleted,
}: HumanVerificationPageProps) {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const stableFramesRef = useRef(0);
  const blinkBaselineRef = useRef(0);
  const blinkPrimedRef = useRef(false);
  const blinkDetectedRef = useRef(false);
  const turnDetectedRef = useRef(false);
  const motionSamplesRef = useRef<Array<{ x: number; y: number }>>([]);
  const signatureSamplesRef = useRef<number[][]>([]);
  const autoSubmitTriggeredRef = useRef(false);
  const submissionInFlightRef = useRef(false);
  const lastAnalysisTimeRef = useRef(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const [faceStatus, setFaceStatus] = useState<FaceCheckStatus>("loading");
  const [faceMessage, setFaceMessage] = useState("Loading live-human detector...");
  const [faceProgress, setFaceProgress] = useState(0);
  const [liveSignals, setLiveSignals] = useState<LiveSignals>({
    singleFace: false,
    framing: false,
    blink: false,
    turn: false,
  });
  const [livenessScore, setLivenessScore] = useState(0);
  const [antiSpoofScore, setAntiSpoofScore] = useState(0);
  const [isDuplicateScreeningReady, setIsDuplicateScreeningReady] = useState(false);
  const [isVerificationLocked, setIsVerificationLocked] = useState(false);

  const configMessage = useMemo(() => {
    if (isSupabaseConfigured) {
      return "";
    }

    return "Supabase is not configured yet. Add the anon key in .env first.";
  }, []);

  useEffect(() => {
    let isCancelled = false;

    getFaceLandmarker()
      .then((landmarker) => {
        if (isCancelled) {
          return;
        }

        landmarkerRef.current = landmarker;
        setIsDetectorReady(true);
        setFaceStatus("no-face");
        setFaceMessage("Live-human detector ready. Turn on your front camera.");
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setFaceStatus("error");
        setFaceMessage("Could not load the live-human detector.");
        setErrorMessage(getErrorMessage(error));
      });

    return () => {
      stopCamera();
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isCameraActive || !isDetectorReady || isVerificationLocked || isSubmitting) {
      stopDetectionLoop();
      return;
    }

    const runDetection = () => {
      const detector = landmarkerRef.current;
      const video = videoRef.current;

      if (
        !detector ||
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        animationFrameRef.current = window.requestAnimationFrame(runDetection);
        return;
      }

      const now = performance.now();

      if (now - lastAnalysisTimeRef.current < ANALYSIS_INTERVAL_MS) {
        animationFrameRef.current = window.requestAnimationFrame(runDetection);
        return;
      }

      lastAnalysisTimeRef.current = now;

      const result = detector.detectForVideo(video, now);
      const landmarks = result.faceLandmarks[0];
      const faceCount = result.faceLandmarks.length;
      const assessment = assessFaceDetection(
        landmarks,
        faceCount,
      );
      const nextStableFrames = assessment.usable
        ? Math.min(REQUIRED_STABLE_FRAMES, stableFramesRef.current + 1)
        : Math.max(0, stableFramesRef.current - 2);
      const nextProgress = clamp(nextStableFrames / REQUIRED_STABLE_FRAMES, 0, 1);
      const singleFace = faceCount === 1 && Boolean(landmarks);
      const framingReady = assessment.usable && nextProgress >= 1;

      if (assessment.usable && landmarks) {
        const eyeAspectRatio = getAverageEyeAspectRatio(landmarks);
        const blinkScore = Math.max(
          getBlendshapeScore(result.faceBlendshapes[0]?.categories, "eyeBlinkLeft"),
          getBlendshapeScore(result.faceBlendshapes[0]?.categories, "eyeBlinkRight"),
        );
        const headTurnRatio = getHeadTurnRatio(landmarks);
        const signatureFeatures = getFaceSignatureFeatures(landmarks);
        const nose = landmarks[LANDMARKS.noseTip];

        if (eyeAspectRatio > 0) {
          blinkBaselineRef.current =
            blinkBaselineRef.current === 0
              ? eyeAspectRatio
              : Math.max(
                  blinkBaselineRef.current * 0.92 + eyeAspectRatio * 0.08,
                  eyeAspectRatio,
                );
        }

        if (
          blinkScore >= BLINK_BLENDSHAPE_THRESHOLD ||
          (blinkBaselineRef.current > 0 &&
            eyeAspectRatio > 0 &&
            eyeAspectRatio <= blinkBaselineRef.current * BLINK_EAR_DROP_RATIO)
        ) {
          blinkPrimedRef.current = true;
        }

        if (
          blinkPrimedRef.current &&
          ((blinkBaselineRef.current > 0 &&
            eyeAspectRatio >= blinkBaselineRef.current * BLINK_EAR_RECOVERY_RATIO) ||
            blinkScore < BLINK_BLENDSHAPE_THRESHOLD * 0.5)
        ) {
          blinkDetectedRef.current = true;
        }

        if (headTurnRatio >= HEAD_TURN_RATIO_THRESHOLD) {
          turnDetectedRef.current = true;
        }

        if (nose) {
          const nextMotionSamples = [...motionSamplesRef.current, { x: nose.x, y: nose.y }];
          motionSamplesRef.current = nextMotionSamples.slice(-18);
        }

        if (signatureFeatures && nextProgress >= 0.5) {
          signatureSamplesRef.current = [...signatureSamplesRef.current, signatureFeatures].slice(
            -8,
          );
        }
      } else {
        blinkPrimedRef.current = false;
      }

      const motionScore = getMotionScore(motionSamplesRef.current);
      const nextLivenessScore = clamp(
        nextProgress * 0.35 +
          (blinkDetectedRef.current ? 0.25 : 0) +
          (turnDetectedRef.current ? 0.25 : 0) +
          motionScore * 0.15,
        0,
        1,
      );
      const nextAntiSpoofScore = clamp(
        (singleFace ? 0.3 : 0) +
          (assessment.usable ? 0.2 : 0) +
          (blinkDetectedRef.current ? 0.25 : 0) +
          (turnDetectedRef.current ? 0.15 : 0) +
          motionScore * 0.1,
        0,
        1,
      );
      const nextSignals: LiveSignals = {
        singleFace,
        framing: framingReady,
        blink: blinkDetectedRef.current,
        turn: turnDetectedRef.current,
      };
      const nextDuplicateScreeningReady =
        signatureSamplesRef.current.length >= FACE_SIGNATURE_MIN_SAMPLES;
      const isLiveHumanReady =
        framingReady &&
        nextSignals.singleFace &&
        nextSignals.blink &&
        nextSignals.turn &&
        nextDuplicateScreeningReady &&
        nextLivenessScore >= MIN_LIVENESS_SCORE &&
        nextAntiSpoofScore >= MIN_ANTI_SPOOF_SCORE;

      let nextStatus: FaceCheckStatus = assessment.status;
      let nextMessage = assessment.message;

      if (assessment.usable && nextProgress >= 1 && !nextSignals.blink) {
        nextStatus = "blink-needed";
        nextMessage = "Blink once naturally so we can confirm this is a live person.";
      } else if (assessment.usable && nextProgress >= 1 && !nextSignals.turn) {
        nextStatus = "turn-needed";
        nextMessage = "Turn your head slightly left or right to confirm live depth.";
      } else if (isLiveHumanReady) {
        nextStatus = "ready";
        nextMessage =
          "Live human confirmed. Face identity samples are ready for the backend check.";
      }

      stableFramesRef.current = nextStableFrames;
      setFaceProgress((current) => (current === nextProgress ? current : nextProgress));
      setFaceStatus((current) => (current === nextStatus ? current : nextStatus));
      setFaceMessage((current) => (current === nextMessage ? current : nextMessage));
      setLiveSignals((current) =>
        current.singleFace === nextSignals.singleFace &&
        current.framing === nextSignals.framing &&
        current.blink === nextSignals.blink &&
        current.turn === nextSignals.turn
          ? current
          : nextSignals,
      );
      setLivenessScore((current) =>
        current === nextLivenessScore ? current : nextLivenessScore,
      );
      setAntiSpoofScore((current) =>
        current === nextAntiSpoofScore ? current : nextAntiSpoofScore,
      );
      setIsDuplicateScreeningReady((current) =>
        current === nextDuplicateScreeningReady ? current : nextDuplicateScreeningReady,
      );

      if (isLiveHumanReady) {
        setIsVerificationLocked(true);
        stopDetectionLoop();
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(runDetection);
    };

    animationFrameRef.current = window.requestAnimationFrame(runDetection);

    return () => {
      stopDetectionLoop();
    };
  }, [isCameraActive, isDetectorReady, isSubmitting, isVerificationLocked]);

  const isFaceReady =
    isVerificationLocked ||
    (liveSignals.singleFace &&
      liveSignals.framing &&
      liveSignals.blink &&
      liveSignals.turn &&
      isDuplicateScreeningReady &&
      livenessScore >= MIN_LIVENESS_SCORE &&
      antiSpoofScore >= MIN_ANTI_SPOOF_SCORE);

  useEffect(() => {
    if (!isCameraActive || !isFaceReady || isSubmitting || autoSubmitTriggeredRef.current) {
      return;
    }

    autoSubmitTriggeredRef.current = true;
    setInfoMessage("All scans passed. Completing verification now...");

    void (humanVerificationMode === "backend"
      ? handleDemoVerification()
      : handleProviderStart());
  }, [isCameraActive, isFaceReady, isSubmitting]);

  function stopDetectionLoop() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function resetFaceCheckState() {
    stableFramesRef.current = 0;
    blinkBaselineRef.current = 0;
    blinkPrimedRef.current = false;
    blinkDetectedRef.current = false;
    turnDetectedRef.current = false;
    motionSamplesRef.current = [];
    signatureSamplesRef.current = [];
    autoSubmitTriggeredRef.current = false;
    submissionInFlightRef.current = false;
    lastAnalysisTimeRef.current = 0;
    setFaceProgress(0);
    setLiveSignals({
      singleFace: false,
      framing: false,
      blink: false,
      turn: false,
    });
    setLivenessScore(0);
    setAntiSpoofScore(0);
    setIsDuplicateScreeningReady(false);
    setIsVerificationLocked(false);

    if (isDetectorReady) {
      setFaceStatus("no-face");
      setFaceMessage("Turn on the front camera and center your face.");
    } else {
      setFaceStatus("loading");
      setFaceMessage("Loading live-human detector...");
    }
  }

  function stopCamera() {
    stopDetectionLoop();
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    resetFaceCheckState();
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("This browser does not support camera access.");
      return;
    }

    setErrorMessage("");
    setInfoMessage("");
    setIsCameraLoading(true);

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 960 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      setInfoMessage(
        "Camera is live. Keep one face centered, blink once, then turn slightly to prove liveness.",
      );
    } catch (error) {
      stopCamera();
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsCameraLoading(false);
    }
  }

  async function refreshUserState() {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error("Supabase is not configured yet. Update the anon key in .env.");
    }

    const { data, error } = await supabase.rpc("get_user_auth_state", {
      user_id_input: authUser.id,
    });

    if (error) {
      throw error;
    }

    const nextUser = Array.isArray(data) ? data[0] : data;

    if (!nextUser) {
      throw new Error("No verification data was returned from Supabase.");
    }

    const userWithSettings = await persistAuthUserWithSettings(nextUser as AuthUser);
    onVerificationCompleted(userWithSettings);

    return userWithSettings;
  }

  async function handleDemoVerification() {
    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured yet. Update the anon key in .env.");
      return;
    }

    if (submissionInFlightRef.current) {
      return;
    }

    if (!isCameraActive || !isFaceReady) {
      setErrorMessage(
        "Keep one live face centered, blink once, and turn slightly until the live-human check is ready.",
      );
      return;
    }

    setErrorMessage("");
    setInfoMessage("");
    submissionInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const evidence = {
        anti_spoof_score: Number(antiSpoofScore.toFixed(2)),
        captured_at: new Date().toISOString(),
        check_version: "mediapipe-live-human-v2",
        liveness_score: Number(livenessScore.toFixed(2)),
        signals: {
          blink: liveSignals.blink,
          framing: liveSignals.framing,
          single_face: liveSignals.singleFace,
          turn: liveSignals.turn,
        },
        stability_progress: Number(faceProgress.toFixed(2)),
      };
      const faceIdentity = await createBackendFaceIdentity({
        supabase,
        provider: humanVerificationProvider,
        samples: signatureSamplesRef.current,
        capturedAt: evidence.captured_at,
      });
      const started = await supabase.rpc("start_human_verification", {
        user_id_input: authUser.id,
        provider_input: humanVerificationProvider,
      });

      if (started.error) {
        throw started.error;
      }

      setInfoMessage("Running the backend face-match and duplicate-prevention check...");
      await wait(600);

      const completed = await supabase.rpc("complete_human_verification", {
        user_id_input: authUser.id,
        provider_input: humanVerificationProvider,
        reference_input: faceIdentity.reference,
        face_id_input: faceIdentity.faceId,
        face_vector_input: faceIdentity.faceVector,
        liveness_score_input: Number(livenessScore.toFixed(2)),
        anti_spoof_score_input: Number(antiSpoofScore.toFixed(2)),
        evidence_input: evidence,
      });

      if (completed.error) {
        if (isMissingCompleteVerificationFunctionError(completed.error)) {
          throw new Error(
            "Your Supabase SQL is still using the older verification function. Apply the latest human verification migration and try again.",
          );
        }

        throw completed.error;
      }

      const updatedUser = Array.isArray(completed.data)
        ? completed.data[0]
        : completed.data;

      if (!updatedUser) {
        throw new Error("No verification result was returned from Supabase.");
      }

      stopCamera();
      const userWithSettings = await persistAuthUserWithSettings(updatedUser);
      onVerificationCompleted(userWithSettings);
    } catch (error) {
      submissionInFlightRef.current = false;
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleProviderStart() {
    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured yet. Update the anon key in .env.");
      return;
    }

    if (submissionInFlightRef.current) {
      return;
    }

    if (!isCameraActive || !isFaceReady) {
      setErrorMessage(
        "Keep one live face centered, blink once, and turn slightly until the live-human check is ready.",
      );
      return;
    }

    setErrorMessage("");
    setInfoMessage("");
    submissionInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc("start_human_verification", {
        user_id_input: authUser.id,
        provider_input: humanVerificationProvider,
      });

      if (error) {
        throw error;
      }

      setInfoMessage(
        "Verification marked as pending. Replace this with your production liveness SDK and only complete verification server-side after the provider returns a real-human, anti-spoof, duplicate-safe result.",
      );

      await refreshUserState();
    } catch (error) {
      submissionInFlightRef.current = false;
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshStatus() {
    setErrorMessage("");
    setInfoMessage("");
    setIsRefreshing(true);

    try {
      const nextUser = await refreshUserState();

      if (nextUser.human_verification_status === "verified") {
        setInfoMessage("Verification complete. Redirecting you into Luminas.");
      } else {
        setInfoMessage("Verification is still pending.");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  function getChecklistStateClasses(isPassed: boolean) {
    return isPassed
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-ig-border bg-white text-ig-text";
  }

  function renderChecklistItem(label: string, isPassed: boolean, pendingLabel = "Waiting") {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${getChecklistStateClasses(
          isPassed,
        )}`}
      >
        <span>{label}</span>
        <span className="font-semibold">{isPassed ? "Passed" : pendingLabel}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ig-bg px-6 py-10">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[32px] border border-ig-border bg-ig-surface p-8 shadow-sm">
          <span className="inline-flex rounded-full border border-ig-border bg-ig-bg px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ig-link">
            Human verification
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ig-text sm:text-5xl">
            One fast live-human face check before entering Luminas.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ig-muted">
            Your account and profile are ready. The final step is a fast
            face-verification flow that checks for one real human face,
            challenges common spoof attempts, and helps prevent duplicate
            identities.
          </p>

          <div className="mt-8 space-y-4 rounded-3xl border border-ig-border bg-ig-bg p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                Status
              </p>
              <p className="mt-1 text-base font-semibold capitalize text-ig-text">
                {authUser.human_verification_status || "required"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                Verification mode
              </p>
              <p className="mt-1 text-base text-ig-text">
                {humanVerificationMode === "backend"
                  ? "Backend face identity flow"
                  : "Provider placeholder flow"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                Provider label
              </p>
              <p className="mt-1 text-base text-ig-text">
                {humanVerificationProvider}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                Best production approach
              </p>
              <p className="mt-1 text-sm leading-6 text-ig-muted">
                Store the canonical face ID and vector on the backend, then let
                only your backend call `complete_human_verification` after the
                live-human, anti-spoof, and duplicate checks pass.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-ig-border bg-ig-surface p-8 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-ig-text">
            Verify your humanity
          </h2>
          <p className="mt-2 text-sm text-ig-muted">
            Any email can sign in. This step is only about confirming one real
            live human face as quickly as possible.
          </p>

          <div className="mt-6 rounded-3xl border border-ig-border bg-ig-bg p-5">
            <ol className="space-y-3 text-sm leading-6 text-ig-muted">
              <li>1. Use the front camera in even lighting.</li>
              <li>2. Keep one uncovered face in frame without masks, hats, or dark glasses.</li>
              <li>3. Hold still, blink once, then turn slightly left or right.</li>
            </ol>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-ig-border bg-black">
            <div className="relative aspect-[3/4] w-full">
              <video
                ref={videoRef}
                className={`h-full w-full object-cover transition-opacity ${
                  isCameraActive ? "opacity-100" : "opacity-0"
                }`}
                autoPlay
                playsInline
                muted
              />

              {!isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/75">
                  {isDetectorReady
                    ? "Camera preview will appear here after you allow access."
                    : "Loading live-human detector before camera analysis starts."}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-ig-border bg-ig-bg p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                  Face check
                </p>
                <p className="mt-1 text-base font-semibold text-ig-text">
                  {getFaceStatusLabel(faceStatus)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                  Readiness
                </p>
                <p className="mt-1 text-base font-semibold text-ig-text">
                  {Math.round(faceProgress * 100)}%
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-ig-link transition-all duration-150"
                style={{ width: `${Math.round(faceProgress * 100)}%` }}
              />
            </div>

            <p className="mt-4 text-sm leading-6 text-ig-muted">{faceMessage}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-ig-border bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                  Liveness score
                </p>
                <p className="mt-1 text-base font-semibold text-ig-text">
                  {Math.round(livenessScore * 100)}%
                </p>
              </div>
              <div className="rounded-2xl border border-ig-border bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                  Anti-spoof score
                </p>
                <p className="mt-1 text-base font-semibold text-ig-text">
                  {Math.round(antiSpoofScore * 100)}%
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-ig-border bg-ig-bg p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
              Live-human checklist
            </p>
            <div className="mt-4 space-y-3 text-sm text-ig-text">
              {renderChecklistItem("Single face only", liveSignals.singleFace)}
              {renderChecklistItem("Framing and stability", liveSignals.framing)}
              {renderChecklistItem("Natural blink detected", liveSignals.blink)}
              {renderChecklistItem("Slight head turn detected", liveSignals.turn)}
              {renderChecklistItem(
                "Face identity samples captured",
                isDuplicateScreeningReady || isVerificationLocked,
                "Pending",
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {(errorMessage || configMessage) && (
              <div className="rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-muted">
                {errorMessage || configMessage}
              </div>
            )}

            {infoMessage && (
              <div className="rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text">
                {infoMessage}
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm font-semibold text-ig-text transition hover:border-ig-link disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCameraLoading}
              onClick={isCameraActive ? stopCamera : startCamera}
            >
              {isCameraLoading
                ? "Starting camera..."
                : isCameraActive
                  ? "Turn off camera"
                  : "Turn on front camera"}
            </button>

            <button
              type="button"
              className="w-full rounded-2xl bg-ig-link px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !isCameraActive || !isFaceReady}
              onClick={
                humanVerificationMode === "backend"
                  ? handleDemoVerification
                  : handleProviderStart
              }
            >
              {isSubmitting
                ? "Checking live human..."
                : humanVerificationMode === "backend"
                  ? "Complete backend face verification"
                  : "Start provider verification"}
            </button>

            <button
              type="button"
              className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm font-semibold text-ig-text transition hover:border-ig-link disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isRefreshing}
              onClick={handleRefreshStatus}
            >
              {isRefreshing ? "Refreshing status..." : "Refresh verification status"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
