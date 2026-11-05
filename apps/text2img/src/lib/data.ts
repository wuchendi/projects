import type { ModelGroup } from '@/types'

// Available models list
export const AVAILABLE_MODELS: ModelGroup[] = [
  {
    id: 'black-forest-labs',
    name: 'Black Forest Labs',
    image: '/providers/blackforestlabs.svg',
    monochrome: true,
    models: [
      {
        id: 'flux-2-klein-9b',
        name: 'FLUX.2 [klein] 9B',
        description: '旗舰级极速模型，支持实时预览与高画质图像编辑。',
        key: '@cf/black-forest-labs/flux-2-klein-9b',
        group: 'black-forest-labs',
        type: 'text2img',
        disabled: false,
        highCost: true,
        supportsReference: true,
      },
      {
        id: 'flux-2-klein-4b',
        name: 'FLUX.2 [klein] 4B',
        description: '轻量化极致测速，适用于对延迟要求极高的实时交互场景。',
        key: '@cf/black-forest-labs/flux-2-klein-4b',
        group: 'black-forest-labs',
        type: 'text2img',
        disabled: false,
        supportsReference: true,
      },
      {
        id: 'flux-2-dev',
        name: 'FLUX.2 [dev]',
        description: '专业级写实工具，支持多参考图生成，细节还原度极高。',
        key: '@cf/black-forest-labs/flux-2-dev',
        group: 'black-forest-labs',
        type: 'text2img',
        disabled: false,
        highCost: true,
        supportsReference: true,
      },
      {
        id: 'flux-1-schnell',
        name: 'FLUX.1 [schnell]',
        description: '高效整流互感器模型，在极短时间内生成高质量艺术构图。',
        key: '@cf/black-forest-labs/flux-1-schnell',
        group: 'black-forest-labs',
        type: 'text2img',
        disabled: false,
      },
    ],
  },
  {
    id: 'leonardo',
    name: 'Leonardo AI',
    image: '/providers/leonardo.svg',
    models: [
      {
        id: 'lucid-origin',
        name: 'Lucid Origin',
        description: '适配性最强的创意模型，精准遵循指令，支持复杂的文本渲染。',
        key: '@cf/leonardo/lucid-origin',
        group: 'leonardo',
        type: 'text2img',
        disabled: false,
        highCost: true,
      },
      {
        id: 'phoenix-1.0',
        name: 'Phoenix 1.0',
        description: '具备卓越的指令遵循能力，生成画面逻辑严密且文本清晰。',
        key: '@cf/leonardo/phoenix-1.0',
        group: 'leonardo',
        type: 'text2img',
        disabled: false,
        highCost: true,
      },
    ],
  },
  {
    id: 'bytedance',
    name: 'ByteDance',
    image: '/providers/bytedance.svg',
    models: [
      {
        id: 'stable-diffusion-xl-lightning',
        name: 'Stable Diffusion XL Lightning',
        description: '闪电级生成速度，几步内即可快速导出 1024px 高清大图。',
        key: '@cf/bytedance/stable-diffusion-xl-lightning',
        group: 'bytedance',
        type: 'text2img',
        disabled: false,
      },
    ],
  },
  {
    id: 'lykon',
    name: 'Lykon',
    models: [
      {
        id: 'dreamshaper-8-lcm',
        name: 'DreamShaper 8 LCM',
        description: '深度优化的写实模型，在保持多样化风格的同时增强照片质感。',
        key: '@cf/lykon/dreamshaper-8-lcm',
        group: 'lykon',
        type: 'text2img',
        disabled: false,
      },
    ],
  },
  {
    id: 'stabilityai',
    name: 'Stability AI',
    image: '/providers/stabilityai.svg',
    models: [
      {
        id: 'stable-diffusion-xl-base-1.0',
        name: 'Stable Diffusion XL Base 1.0',
        description:
          '行业标准基座模型，提供稳定、高质量的文生图与图像修改功能。',
        key: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        group: 'stabilityai',
        type: 'text2img',
        disabled: false,
      },
    ],
  },
  {
    id: 'runwayml',
    name: 'Runway ML',
    image: '/providers/runway.svg',
    models: [
      {
        id: 'stable-diffusion-v1-5-img2img',
        name: 'Stable Diffusion v1.5 img2img',
        description: '经典的图生图模型，支持以现有图像为底稿进行艺术再创作。',
        key: '@cf/runwayml/stable-diffusion-v1-5-img2img',
        group: 'runwayml',
        type: 'img2img',
        disabled: true,
      },
      {
        id: 'stable-diffusion-v1-5-inpainting',
        name: 'Stable Diffusion v1.5 Inpainting',
        description: '专业的局部重绘模型，通过遮罩精准修改或修复图像特定区域。',
        key: '@cf/runwayml/stable-diffusion-v1-5-inpainting',
        group: 'runwayml',
        type: 'inpainting',
        disabled: false,
      },
    ],
  },
]

// Random prompts list
export const RANDOM_PROMPTS = [
  // =========================
  // Cyberpunk
  // =========================
  'cyberpunk cat samurai graphic art, blood splattered, beautiful colors',
  'cyberpunk cat(neon lights:1.3) clutter, ultra detailed, ctrash, chaotic, low light, contrast, dark, rain, at night, cinematic, dystopic, broken ground, tunnels, skyscrapers',
  'Cyberpunk catgirl with purple hair, wearing leather and latex outfit with pink and purple cheetah print, holding a hand gun, black latex brassiere, glowing blue eyes with purple tech sunglasses, tail, large breasts, glowing techwear clothes, handguns, black leather jacket, tight shiny leather pants, cyberpunk alley background, Cyb3rWar3, Cyberware',
  'masterpiece, best quality, absurdres, ultra-detailed, cinematic lighting, rainy street, neon reflections, 1girl, short silver hair, red eyes, black hoodie, cyberpunk city, vending machines, glowing signs, fog, depth of field, bokeh, moody atmosphere',
  '1girl, solo, street fashion, oversized jacket, headphones, neon gradient lighting, futuristic subway station, hologram ads, reflections, cinematic, sharp focus, detailed eyes, masterpiece, best quality',

  // =========================
  // Anime Girls / Characters
  // =========================
  '1girl, hatsune miku, white pupils, power elements, microphone, vibrant blue color palette, abstract, abstract background, dreamlike atmosphere, delicate linework, wind-swept hair, energy, masterpiece, best quality, amazing quality',
  'masterpiece, best quality, amazing quality, very aesthetic, high resolution, ultra-detailed, absurdres, newest, scenery, anime, anime coloring, (dappled sunlight:1.2), rim light, backlit, dramatic shadow, 1girl, long blonde hair, blue eyes, shiny eyes, parted lips, medium breasts, puffy sleeve white dress, forest, flowers, white butterfly, looking at viewer',
  'masterpiece, newest, absurdres, incredibly absurdres, best quality, amazing quality, very aesthetic, 1girl, very long hair, blonde, multi-tied hair, center-flap bangs, sunset, cumulonimbus cloud, old tree, sitting in tree, dark blue track suit, adidas, simple bird',
  '1girl, solo, long black hair, red ribbon, shrine maiden outfit, katana, autumn maple leaves, torii gate, sunset glow, wind, falling leaves, detailed face, sharp focus, japanese aesthetic, masterpiece, best quality',
  '1girl, solo, ice queen, long white hair, blue eyes, crystal crown, frozen palace, snowstorm outside, sparkling ice particles, rim light, highly detailed, sharp focus, masterpiece, best quality',

  // =========================
  // Nature / Camping / Scenery
  // =========================
  '1girl, solo, outdoors, camping, night, mountains, nature, stars, moon, tent, twin ponytails, green eyes, cheerful, happy, backpack, sleeping bag, camping stove, water bottle, mountain boots, gloves, sweater, hat, flashlight, forest, rocks, river, wood, smoke, shadows, contrast, clear sky, constellations, Milky Way',
  'masterpiece, best quality, highres, fantasy scenery, ancient ruins, giant stone statue, overgrown vines, sunlight beams, floating dust particles, dramatic scale, wide shot, epic composition, highly detailed background',
  'masterpiece, best quality, absurdres, underwater city, bioluminescent coral, glowing jellyfish, deep sea light rays, 1girl, long aqua hair, white dress floating, serene expression, dreamy, highly detailed, fantasy atmosphere',
  'a wide aerial view of a floating elven city in the sky, with two elven figures walking side by side across a glowing skybridge, the bridge arching between tall crystal towers, surrounded by clouds and golden light, majestic and serene atmosphere, vivid style, magical fantasy architecture',
  'masterpiece, best quality, studio ghibli style, cozy small room, warm lamp light, rainy window, books everywhere, cat sleeping on chair, tea cup steam, peaceful atmosphere, detailed background',

  // =========================
  // Combat / Military / Dark Fantasy
  // =========================
  'beautiful girl, breasts, curvy, looking down scope, looking away from viewer, laying on the ground, laying ontop of jacket, aiming a sniper rifle, dark braided hair, backwards hat, armor, sleeveless, arm sleeve tattoos, muscle tone, dogtags, sweaty, foreshortening, depth of field, at night, alpine, lightly snowing, dusting of snow, closeup, detailed face, freckles',
  'cyberpunk mech, ultra detailed, hard surface, glowing energy core, rain, smoke, industrial background, broken pipes, sparks, cinematic shot, dramatic shadows, high contrast, masterpiece, best quality',
  'dark fantasy knight, black armor, crimson cape, glowing red sword, ruined battlefield, burning sky, ashes, smoke, epic, ultra-detailed, dramatic lighting, masterpiece, best quality, high resolution',

  // =========================
  // Holiday / Christmas
  // =========================
  'frost_glass, masterpiece, best quality, absurdres, cute girl wearing red Christmas dress, holding small reindeer, hug, braided ponytail, sidelocks, hairclip, hair ornaments, green eyes, (snowy forest, moonlight, Christmas trees), (sparkles, sparkling clothes), frosted, snow, aurora, moon, night, sharp focus, highly detailed, abstract, flowing',

  // =========================
  // Space / Sci-Fi
  // =========================
  'space opera, massive spaceship interior, huge window view of galaxy, purple nebula, starfields, astronaut silhouette, volumetric lighting, cinematic wide shot, ultra detailed, masterpiece, best quality',
]
