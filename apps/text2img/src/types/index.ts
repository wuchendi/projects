export type ModelType = 'text2img' | 'img2img' | 'inpainting'

export interface Model {
  id: string
  name: string
  description: string
  key: string
  disabled: boolean
  group: string
  type: ModelType
  /** Accepts up to 4 reference images (FLUX.2 `input_image_0..3`). */
  supportsReference?: boolean
  /** Burns a large share of the daily free Neurons per image. */
  highCost?: boolean
}

export interface ModelGroup {
  id: string
  name: string
  image?: string
  /** Black-on-transparent icon; inverted in dark mode. */
  monochrome?: boolean
  models: Model[]
}

export enum GenerationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface GenerationResult {
  id: string
  status: GenerationStatus
  params: GenerateParams
  /** Generated image. Persisted as-is in IndexedDB. */
  blob?: Blob
  /** Session-only object URL, rebuilt from `blob` after rehydrate. */
  imageUrl?: string
  error?: string
  generationTime?: number
}

export interface GenerateParams {
  prompt: string
  model: string
  password?: string
  negative_prompt?: string
  width?: number
  height?: number
  num_steps?: number
  guidance?: number
  seed?: number
  image_b64?: string
  mask_b64?: string
  reference_images_b64?: string[]
}
