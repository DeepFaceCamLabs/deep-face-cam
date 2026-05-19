export interface AppState {
  name: string;
  version: string;
  edition: string;

  source_path: string | null;
  target_path: string | null;
  output_path: string | null;

  keep_fps: boolean;
  keep_audio: boolean;
  keep_frames: boolean;
  many_faces: boolean;
  map_faces: boolean;
  poisson_blend: boolean;
  color_correction: boolean;
  nsfw_filter: boolean;
  live_mirror: boolean;
  live_resizable: boolean;
  show_fps: boolean;
  mouth_mask: boolean;
  show_mouth_mask_box: boolean;
  mouth_mask_size: number;

  opacity: number;
  sharpness: number;

  video_encoder: string;
  video_quality: number;

  enable_interpolation: boolean;
  interpolation_weight: number;

  fp_ui: {
    face_enhancer: boolean;
    face_enhancer_gpen256: boolean;
    face_enhancer_gpen512: boolean;
  };
  enhancer: "None" | "GFPGAN" | "GPEN-512" | "GPEN-256";

  execution_providers: string[];
  available_providers: string[];
  execution_threads: number | null;
  max_memory: number | null;

  cameras: Array<{ index: number; name: string; disabled?: boolean }>;
  processing: boolean;
  live_running: boolean;

  is_target_image: boolean;
  is_target_video: boolean;
  runtime_paths?: {
    backend_root: string;
    app_data_dir: string;
    models_dir: string;
    outputs_dir: string;
    cache_dir: string;
  };
}

export interface MapEntry {
  id: number;
  source: string | null; // data: url
  target: string | null;
}

export interface ModelInfo {
  id: string;
  filename: string;
  purpose: string;
  required: boolean;
  present: boolean;
  downloadable: boolean;
  size_bytes: number;
  path: string;
  source_page?: string | null;
}

export interface ModelStatus {
  models_dir: string;
  manifest_path?: string | null;
  missing_required: string[];
  models: ModelInfo[];
}

export type ServerEvent =
  | { event: "hello"; state: AppState }
  | { event: "status"; text: string }
  | {
      event: "model_download";
      phase?: string;
      id?: string;
      bytes?: number;
      total?: number;
      error?: string;
    }
  | { event: "processing_done" };
