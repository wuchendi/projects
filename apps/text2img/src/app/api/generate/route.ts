import { verifyPasswordFn } from '@cdlab/utils'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { AVAILABLE_MODELS, findModelById } from '@/lib'
import { corsPreflight, withCors } from '@/lib/cors'

interface GenerateRequest {
  prompt?: string
  model?: string
  password?: string
  negative_prompt?: string
  width?: number
  height?: number
  num_steps?: number
  strength?: number
  guidance?: number
  seed?: number
  image_b64?: string
  mask_b64?: string
  reference_images_b64?: string[]
}

const MAX_REFERENCE_IMAGES = 4

interface ModelConfig {
  prepareInputs: (data: GenerateRequest) => any
  processResponse: (response: any) => Response
}

const defaultModelConfig: ModelConfig = {
  prepareInputs: (data: GenerateRequest) => ({
    prompt: data.prompt || 'cyberpunk cat',
    negative_prompt: data.negative_prompt || '',
    height: data.height || 1024,
    width: data.width || 1024,
    num_steps: data.num_steps || 20,
    strength: data.strength || 0.1,
    guidance: data.guidance || 7.5,
    seed: data.seed || Math.floor(Math.random() * 1024 * 1024),
  }),
  processResponse: (response: any) => {
    return new Response(response, {
      headers: {
        'content-type': 'image/png',
      },
    })
  },
}

const blackForestLabsConfig: ModelConfig = {
  prepareInputs: (data: GenerateRequest) => {
    if (data.model === 'flux-1-schnell') {
      let steps = data.num_steps || 6
      if (steps >= 8) steps = 8
      else if (steps <= 4) steps = 4

      return {
        prompt: data.prompt || 'cyberpunk cat',
        steps: steps,
      }
    }

    const formData = new FormData()
    formData.append('prompt', data.prompt || 'cyberpunk cat')

    if (data.negative_prompt) {
      formData.append('negative_prompt', data.negative_prompt)
    }
    if (data.width) {
      formData.append('width', data.width.toString())
    }
    if (data.height) {
      formData.append('height', data.height.toString())
    }
    // klein models run a fixed 4 steps; only dev accepts `steps`.
    if (data.num_steps && data.model === 'flux-2-dev') {
      formData.append('steps', data.num_steps.toString())
    }
    if (data.guidance) {
      formData.append('guidance', data.guidance.toString())
    }

    const seed =
      data.seed !== undefined
        ? data.seed
        : Math.floor(Math.random() * 1024 * 1024)
    formData.append('seed', seed.toString())

    // Prompts refer to these as "image 0", "image 1", ...
    data.reference_images_b64?.forEach((b64, i) => {
      formData.append(
        `input_image_${i}`,
        new Blob([new Uint8Array(base64ToUint8Array(b64))]),
      )
    })

    const req = new Request('http://placeholder', {
      method: 'POST',
      body: formData,
    })

    return {
      multipart: {
        body: req.body,
        contentType: req.headers.get('content-type') || 'multipart/form-data',
      },
    }
  },
  processResponse: (response: any) => {
    let jsonResponse: any

    if (typeof response === 'object') {
      jsonResponse = response
    } else {
      try {
        jsonResponse = JSON.parse(response)
      } catch (e: any) {
        console.error('Failed to parse JSON response:', e)
        return new Response(
          JSON.stringify({
            error: 'Failed to parse response',
            details: e.message,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }
    }

    if (!jsonResponse.image) {
      return new Response(
        JSON.stringify({
          error: 'Invalid response format',
          details: 'Image data not found in response',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    try {
      // Convert from base64 to binary data
      const binaryString = atob(jsonResponse.image)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      return new Response(bytes, {
        headers: {
          'content-type': 'image/png',
        },
      })
    } catch (e: any) {
      console.error('Failed to convert base64 to binary:', e)
      return new Response(
        JSON.stringify({
          error: 'Failed to process image data',
          details: e.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }
  },
}

const leonardoConfig: ModelConfig = {
  prepareInputs: (data: GenerateRequest) => ({
    prompt: data.prompt || 'cyberpunk cat',
    // Only phoenix accepts negative_prompt, and it rejects an empty string.
    ...(data.model === 'phoenix-1.0' && data.negative_prompt
      ? { negative_prompt: data.negative_prompt }
      : {}),
    height: data.height || 1024,
    width: data.width || 1024,
    num_steps: data.num_steps || 25,
    // Both models accept guidance in [2, 10] (lucid-origin allows 0+).
    guidance: Math.min(Math.max(data.guidance || 4, 2), 10),
    seed: data.seed || Math.floor(Math.random() * 1024 * 1024),
  }),
  processResponse: (response: any) => {
    const result = response?.result ?? response
    const imageData = result?.image ?? result

    if (typeof imageData === 'string') {
      try {
        const binaryString = atob(imageData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return new Response(bytes, {
          headers: { 'content-type': 'image/png' },
        })
      } catch (e: any) {
        return new Response(
          JSON.stringify({
            error: 'Failed to process image data',
            details: e.message,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    return new Response(imageData, {
      headers: { 'content-type': 'image/png' },
    })
  },
}

function base64ToUint8Array(base64: string): number[] {
  const binaryString = atob(base64)
  const bytes = new Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

const img2imgConfig: ModelConfig = {
  prepareInputs: (data: GenerateRequest) => ({
    prompt: data.prompt || 'cyberpunk cat',
    ...(data.image_b64 ? { image: base64ToUint8Array(data.image_b64) } : {}),
    negative_prompt: data.negative_prompt || '',
    height: data.height || 512,
    width: data.width || 512,
    num_steps: data.num_steps || 20,
    strength: data.strength || 0.75,
    guidance: data.guidance || 7.5,
    seed: data.seed || Math.floor(Math.random() * 1024 * 1024),
  }),
  processResponse: (response: any) => {
    const imageData = response?.image ?? response

    if (typeof imageData === 'string') {
      try {
        const binaryString = atob(imageData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return new Response(bytes, {
          headers: { 'content-type': 'image/png' },
        })
      } catch (e: any) {
        return new Response(
          JSON.stringify({
            error: 'Failed to process image data',
            details: e.message,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    return new Response(imageData, {
      headers: { 'content-type': 'image/png' },
    })
  },
}

const inpaintingConfig: ModelConfig = {
  prepareInputs: (data: GenerateRequest) => ({
    prompt: data.prompt || 'cyberpunk cat',
    ...(data.image_b64 ? { image: base64ToUint8Array(data.image_b64) } : {}),
    ...(data.mask_b64 ? { mask: base64ToUint8Array(data.mask_b64) } : {}),
    negative_prompt: data.negative_prompt || '',
    height: data.height || 512,
    width: data.width || 512,
    num_steps: data.num_steps || 20,
    strength: data.strength || 1,
    guidance: data.guidance || 7.5,
    seed: data.seed || Math.floor(Math.random() * 1024 * 1024),
  }),
  processResponse: img2imgConfig.processResponse,
}

const MODEL_GROUP_CONFIGS: Record<string, ModelConfig> = {
  'black-forest-labs': blackForestLabsConfig,
  leonardo: leonardoConfig,
  bytedance: defaultModelConfig,
  lykon: defaultModelConfig,
  stabilityai: defaultModelConfig,
  runwayml: defaultModelConfig,
}

const MODEL_TYPE_CONFIGS: Record<string, ModelConfig> = {
  img2img: img2imgConfig,
  inpainting: inpaintingConfig,
}

export async function POST(request: Request) {
  return withCors(await generate(request))
}

export function OPTIONS() {
  return corsPreflight()
}

async function generate(request: Request): Promise<Response> {
  const data = (await request.json()) as GenerateRequest

  const { env } = getCloudflareContext()

  // Passwords for authentication
  const PASSWORDS = process.env.PASSWORDS
    ? process.env.PASSWORDS.split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : []

  // Check password
  if (PASSWORDS.length > 0) {
    if (!data.password) {
      return new Response(JSON.stringify({ error: 'Password is required' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // The client sends an Argon2id hash of the password (see useGeneration),
    // so the plaintext never travels over the wire. Verify it against each
    // configured plaintext password.
    let authorized = false
    for (const candidate of PASSWORDS) {
      try {
        if (await verifyPasswordFn(data.password, candidate)) {
          authorized = true
          break
        }
      } catch {
        // Malformed hash from client — treat as a mismatch.
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Incorrect password' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
  }

  if ('prompt' in data && 'model' in data) {
    const selectedModel = findModelById(AVAILABLE_MODELS, data.model!)
    if (!selectedModel) {
      return new Response(JSON.stringify({ error: 'Model is invalid' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Check if model is disabled
    if (selectedModel.disabled) {
      return new Response(
        JSON.stringify({ error: 'This model is currently disabled' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const references = data.reference_images_b64
    if (references !== undefined) {
      if (!selectedModel.supportsReference) {
        return new Response(
          JSON.stringify({
            error: 'This model does not support reference images',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (
        !Array.isArray(references) ||
        references.length > MAX_REFERENCE_IMAGES ||
        references.some((r) => typeof r !== 'string' || !r)
      ) {
        return new Response(
          JSON.stringify({
            error: `reference_images_b64 must be at most ${MAX_REFERENCE_IMAGES} non-empty base64 strings`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    const model = selectedModel.key as keyof AiModels

    const modelConfig =
      MODEL_TYPE_CONFIGS[selectedModel.type] ||
      (selectedModel.group
        ? MODEL_GROUP_CONFIGS[selectedModel.group] || defaultModelConfig
        : defaultModelConfig)

    console.log(
      `Generating image with ${model} (group: ${selectedModel.group}) and prompt: ${data.prompt?.substring(0, 50)}...`,
    )

    try {
      const inputs = modelConfig.prepareInputs(data)
      const response = await env.AI.run(model, inputs)

      return modelConfig.processResponse(response)
    } catch (aiError) {
      console.error('AI generation error:', aiError)
      return new Response(
        JSON.stringify({
          error: 'Image generation failed',
          details: aiError instanceof Error ? aiError.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  } else {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: prompt or model' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
