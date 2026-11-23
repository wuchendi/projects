'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Cascader } from '@cdlab/ui/components/cascader'
import { Field, FieldGroup, FieldTitle } from '@cdlab/ui/components/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@cdlab/ui/components/input-group'
import { Label } from '@cdlab/ui/components/label'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { Slider } from '@cdlab/ui/components/slider'
import { StatusEnum } from '@cdlab/ui/IK'
import { copyToClipboard } from '@cdlab/utils'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ClipboardPaste, Copy, Loader2, Timer, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiManagerDialog } from '@/components/api-manager'
import type { BuiltinApiId } from '@/lib/builtin-apis'
import { BUILTIN_APIS, isBuiltinId } from '@/lib/builtin-apis'
import { genid } from '@/lib/genid'
import { escapeXml, splitText } from '@/lib/utils'
import { useApiStore } from '@/store/useApiStore'
import { useHistoryStore } from '@/store/useHistoryStore'

interface SpeakerConfig {
  [key: string]: { speakers: Record<string, string> }
}

export default function TTSForm() {
  const [selectedApiId, setSelectedApiId] = useState<string>('edge-api')
  const [speaker, setSpeaker] = useState('')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [rate, setRate] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [pauseSeconds, setPauseSeconds] = useState(1)
  const [instructions, setInstructions] = useState('')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [isGenerating, setIsGenerating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { customApis, builtinOverrides } = useApiStore()
  const { addHistory, updateHistory } = useHistoryStore()

  const getEffectiveBuiltin = (id: BuiltinApiId) => ({
    ...BUILTIN_APIS[id],
    ...builtinOverrides[id],
  })

  const { data: speakersData, isError: isSpeakersError } =
    useQuery<SpeakerConfig>({
      queryKey: ['speakers'],
      queryFn: async () => {
        const res = await fetch('/speakers.json')
        if (!res.ok) throw new Error('Failed to load speakers')
        return res.json()
      },
    })

  const edgeSpeakers = speakersData?.['edge-api']?.speakers ?? {}

  // Resolve current API config
  const isBuiltin = isBuiltinId(selectedApiId)
  const currentCustomApi = !isBuiltin
    ? (customApis[selectedApiId] ?? null)
    : null
  const currentFormat: 'openai' | 'edge' = isBuiltin
    ? BUILTIN_APIS[selectedApiId].format
    : (currentCustomApi?.format ?? 'edge')
  const isEdgeFormat = currentFormat === 'edge'

  // Speakers for the active API
  const activeSpeakers: Record<string, string> = (() => {
    if (selectedApiId === 'edge-api') return edgeSpeakers
    if (selectedApiId === 'oai-tts') return BUILTIN_APIS['oai-tts'].speakers
    return Object.fromEntries(
      (currentCustomApi?.manual ?? []).map((s) => [s, s]),
    )
  })()

  // value -> label map so the Select trigger shows the API name, not its id
  const apiItems: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(BUILTIN_APIS).map(([id, api]) => [id, api.label]),
    ),
    ...Object.fromEntries(
      Object.values(customApis).map((api) => [
        api.id,
        `${api.name} (${api.format === 'openai' ? 'OpenAI' : 'Edge'})`,
      ]),
    ),
  }

  const maxLength = (() => {
    if (isBuiltin)
      return getEffectiveBuiltin(selectedApiId as BuiltinApiId).maxLength
    if (currentCustomApi?.format === 'openai')
      return currentCustomApi.maxLength ?? 4096
    return 50000
  })()

  const splitLength = (() => {
    if (isBuiltin)
      return getEffectiveBuiltin(selectedApiId as BuiltinApiId).splitLength
    if (currentCustomApi?.format === 'openai')
      return currentCustomApi.maxLength ?? 4096
    return 5000
  })()

  useEffect(() => {
    if (!isBuiltinId(selectedApiId) && !customApis[selectedApiId]) {
      setSelectedApiId('edge-api')
    }
  }, [customApis, selectedApiId])

  useEffect(() => {
    if (isSpeakersError) toast.error('加载讲述者失败，请刷新页面重试。')
  }, [isSpeakersError])

  // Reset speaker when API changes
  useEffect(() => {
    setSpeaker(Object.keys(activeSpeakers)[0] || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApiId])

  // Set initial edge speaker once speakersData loads
  useEffect(() => {
    if (edgeSpeakers && !speaker && selectedApiId === 'edge-api') {
      setSpeaker(Object.keys(edgeSpeakers)[0] || '')
    }
  }, [edgeSpeakers, speaker, selectedApiId])

  const { mutateAsync: ttsRequest } = useMutation({
    mutationFn: async ({
      text,
      speakerId,
      isPreview,
      rate,
      pitch,
    }: {
      text: string
      speakerId: string
      isPreview: boolean
      rate: number
      pitch: number
    }) => {
      const headers: Record<string, string> = {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
      }

      let url: string
      let body: Record<string, unknown>

      if (selectedApiId === 'edge-api') {
        const effective = getEffectiveBuiltin('edge-api')
        url = effective.endpoint
        if (effective.apiKey && effective.authHeaderName) {
          headers[effective.authHeaderName] = effective.apiKey
        }
        body = {
          text,
          voice: speakerId,
          rate,
          pitch,
          preview: isPreview,
        }
      } else if (selectedApiId === 'oai-tts') {
        const effective = getEffectiveBuiltin('oai-tts')
        url = effective.endpoint
        if (effective.apiKey && effective.authHeaderName) {
          headers[effective.authHeaderName] = effective.apiKey
        }
        const cleanText = text.replace(
          /<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g,
          '',
        )
        body = {
          model: 'tts-1',
          input: cleanText,
          voice: speakerId,
          response_format: audioFormat,
          ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        }
      } else if (currentCustomApi) {
        url = currentCustomApi.endpoint
        if (currentCustomApi.apiKey && currentCustomApi.authHeaderName) {
          headers[currentCustomApi.authHeaderName] = currentCustomApi.apiKey
        }
        if (currentCustomApi.format === 'openai') {
          const cleanText = text.replace(
            /<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g,
            '',
          )
          body = {
            model: speakerId,
            input: cleanText,
            voice: 'alloy',
            response_format: audioFormat,
            ...(instructions.trim()
              ? { instructions: instructions.trim() }
              : {}),
          }
        } else {
          body = {
            text: escapeXml(text),
            voice: speakerId,
            rate,
            pitch,
            preview: isPreview,
          }
        }
      } else {
        throw new Error('未知的 API 配置')
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`服务器响应错误: ${response.status}`)
      const blob = await response.blob()
      if (!blob.type.includes('audio/') || blob.size === 0)
        throw new Error('Invalid audio file!')
      return blob
    },
  })

  const groupSpeakers = (speakersObj: Record<string, string>) => {
    const groups: Record<string, [string, string][]> = {}
    Object.entries(speakersObj).forEach(([key, value]) => {
      const match = key.match(/^([a-z]{2,3}-[A-Z]{2,3})/)
      const group = match ? match[1] : '其他'
      if (!groups[group]) groups[group] = []
      groups[group].push([key, value])
    })
    return groups
  }

  const handleCopy = async () => {
    const success = await copyToClipboard(text)
    if (success) {
      toast.success('已复制到剪贴板')
    } else {
      toast.error('复制失败')
    }
  }

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      setText(text.substring(0, start) + clipText + text.substring(end))
    } catch {
      toast.error('无法读取剪贴板')
    }
  }

  const handleInsertPause = () => {
    if (isNaN(pauseSeconds) || pauseSeconds < 0.01 || pauseSeconds > 100) {
      toast.error('请输入0.01到100之间的数字')
      return
    }
    const textarea = textareaRef.current
    if (!textarea) return
    const cursorPos = textarea.selectionStart
    setText(
      text.substring(0, cursorPos) +
        `<break time="${pauseSeconds}s"/>` +
        text.substring(textarea.selectionEnd),
    )
  }

  const getApiLabel = () => {
    if (isBuiltin) {
      return BUILTIN_APIS[selectedApiId as BuiltinApiId].label
    }
    return currentCustomApi?.name ?? selectedApiId
  }

  const generateVoice = async (isPreview: boolean) => {
    if (isGenerating) {
      toast.error('请等待当前语音生成完成')
      return
    }
    if (!text.trim()) {
      toast.error('请输入要转换的文本')
      return
    }

    setIsGenerating(true)
    const enableSeg = currentCustomApi
      ? (currentCustomApi.enableSegmentation ?? true)
      : true
    const segments = isPreview
      ? [text.substring(0, 20)]
      : enableSeg
        ? splitText(text, splitLength)
        : [text.substring(0, splitLength)]
    const requestId = String(genid.nextId())

    if (!isPreview) {
      addHistory({
        id: requestId,
        name: name.trim() || undefined,
        timestamp: new Date().toLocaleString(),
        speaker: activeSpeakers[speaker] || speaker,
        text,
        requestInfo: getApiLabel(),
        status: StatusEnum.PROCESSING,
      })
    }

    try {
      if (segments.length > 1) {
        toast.info(`正在生成#${requestId}请求的 1/${segments.length} 段语音...`)
        const blobs: Blob[] = []
        for (let i = 0; i < segments.length; i++) {
          const blob = await ttsRequest({
            text: segments[i],
            speakerId: speaker,
            isPreview,
            rate,
            pitch,
          })
          blobs.push(blob)
          toast.info(
            `正在生成#${requestId}请求的 ${i + 1}/${segments.length} 段语音...`,
          )
        }
        const merged = new Blob(blobs, { type: 'audio/mpeg' })
        if (!isPreview) {
          updateHistory(requestId, {
            status: StatusEnum.COMPLETED,
            audioBlob: merged,
          })
        }
      } else {
        toast.info(`正在生成#${requestId}请求的语音...`)
        const blob = await ttsRequest({
          text: segments[0],
          speakerId: speaker,
          isPreview,
          rate,
          pitch,
        })
        if (isPreview) {
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audio.onended = () => URL.revokeObjectURL(url)
          audio.play()
        } else {
          updateHistory(requestId, {
            status: StatusEnum.COMPLETED,
            audioBlob: blob,
          })
        }
      }
    } catch (error) {
      const message = (error as Error).message
      toast.error(`生成失败：${message}`)
      if (!isPreview) {
        updateHistory(requestId, { status: StatusEnum.FAILED, error: message })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card size="sm" className="h-full min-h-0">
      <CardHeader className="shrink-0">
        <CardTitle>文本转语音</CardTitle>
        <CardDescription>输入文本，选择讲述者，生成语音</CardDescription>
        <CardAction>
          <ApiManagerDialog
            onApiChange={(id) => {
              if (id) setSelectedApiId(id)
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden px-0">
        <ScrollArea className="h-full">
          <FieldGroup className="gap-3.5 px-3">
            {/* API selector */}
            <Field>
              <Label>选择 API</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedApiId}
                  items={apiItems}
                  onValueChange={(v) => {
                    if (v) setSelectedApiId(v)
                  }}
                >
                  <SelectTrigger size="sm" className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>内置</SelectLabel>
                      {(
                        Object.entries(BUILTIN_APIS) as [
                          BuiltinApiId,
                          (typeof BUILTIN_APIS)[BuiltinApiId],
                        ][]
                      )
                        .filter(([, api]) => api.enabled)
                        .map(([id, api]) => (
                          <SelectItem key={id} value={id}>
                            {api.label}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                    {Object.keys(customApis).length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>自定义</SelectLabel>
                          {Object.values(customApis).map((api) => (
                            <SelectItem key={api.id} value={api.id}>
                              {api.name}
                              <span className="text-xs text-muted-foreground">
                                ({api.format === 'openai' ? 'OpenAI' : 'Edge'})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </Field>

            {/* Speaker selector */}
            <Field>
              <Label>选择语音</Label>
              {selectedApiId === 'edge-api' ? (
                <Cascader
                  placeholder="选择语音"
                  size="sm"
                  className="w-full"
                  allowClear={false}
                  value={
                    speaker
                      ? [
                          speaker.match(/^([a-z]{2,3}-[A-Z]{2,3})/)?.[1] ??
                            '其他',
                          speaker,
                        ]
                      : []
                  }
                  options={Object.entries(groupSpeakers(edgeSpeakers)).map(
                    ([group, items]) => ({
                      value: group,
                      label: group,
                      children: items.map(([key, value]) => ({
                        value: key,
                        label: value,
                      })),
                    }),
                  )}
                  onChange={([, speakerKey]) => {
                    if (speakerKey) setSpeaker(speakerKey)
                  }}
                />
              ) : (
                <Select
                  value={speaker || null}
                  items={activeSpeakers}
                  onValueChange={(v) => {
                    if (v) setSpeaker(v)
                  }}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="选择语音" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(activeSpeakers).length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        请先在 API 管理中配置讲述人
                      </SelectItem>
                    ) : (
                      Object.entries(activeSpeakers).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field>
              <Label>自定义名称</Label>
              <InputGroup className="h-7">
                <InputGroupInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="留空则默认使用文件名"
                  maxLength={100}
                />
              </InputGroup>
            </Field>

            <Field>
              <Label>输入文本</Label>
              <InputGroup className="h-auto flex-col">
                <InputGroupAddon
                  align="block-start"
                  className="border-b justify-end"
                >
                  <InputGroupButton
                    variant="ghost"
                    onClick={handlePaste}
                    title="粘贴"
                  >
                    <ClipboardPaste />
                  </InputGroupButton>
                  <InputGroupButton
                    variant="ghost"
                    onClick={handleCopy}
                    disabled={!text}
                    title="复制"
                  >
                    <Copy />
                  </InputGroupButton>
                  <InputGroupButton
                    variant="ghost"
                    onClick={() => setText('')}
                    disabled={!text}
                    title="清空"
                  >
                    <Trash2 />
                  </InputGroupButton>
                </InputGroupAddon>

                <InputGroupTextarea
                  id="text"
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  maxLength={maxLength}
                  placeholder="请输入要转换的文本"
                  className="min-h-[90px] bg-card/50"
                />
                <InputGroupAddon align="block-end" className="border-t">
                  <InputGroupText className="text-xs text-muted-foreground">
                    {text.length} / {maxLength} 字符
                    {isEdgeFormat && '，长文本将自动分段'}
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            {/* OpenAI-specific: instructions & audio format */}
            {!isEdgeFormat && (
              <>
                <Field>
                  <Label>语音指令（可选）</Label>
                  <InputGroup className="h-auto">
                    <InputGroupTextarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={2}
                      placeholder="描述语音风格，例如：请用温柔缓慢的语气朗读"
                      className="bg-card/50"
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <Label>音频格式</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const
                    ).map((fmt) => (
                      <Button
                        key={fmt}
                        variant={audioFormat === fmt ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAudioFormat(fmt)}
                      >
                        {fmt.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {/* Edge-only controls */}
            {isEdgeFormat && (
              <>
                <Field>
                  <div className="flex justify-between items-center">
                    <FieldTitle>停顿</FieldTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {pauseSeconds ? `${pauseSeconds}秒` : '0秒'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleInsertPause}
                      >
                        <Timer className="size-3.5" />
                        插入
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[pauseSeconds]}
                    onValueChange={(value) =>
                      setPauseSeconds(Array.isArray(value) ? value[0] : value)
                    }
                    min={0}
                    max={10}
                    step={1}
                  />
                </Field>

                <Field>
                  <div className="flex justify-between">
                    <FieldTitle>语速</FieldTitle>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {rate}
                    </span>
                  </div>
                  <Slider
                    value={[rate]}
                    onValueChange={(value) =>
                      setRate(Array.isArray(value) ? value[0] : value)
                    }
                    min={-100}
                    max={100}
                    step={1}
                  />
                </Field>

                <Field>
                  <div className="flex justify-between">
                    <FieldTitle>语调</FieldTitle>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {pitch}
                    </span>
                  </div>
                  <Slider
                    value={[pitch]}
                    onValueChange={(value) =>
                      setPitch(Array.isArray(value) ? value[0] : value)
                    }
                    min={-100}
                    max={100}
                    step={1}
                  />
                </Field>
              </>
            )}
          </FieldGroup>
        </ScrollArea>
      </CardContent>
      <CardFooter className="shrink-0">
        <div className="flex flex-row gap-2 w-full">
          {isGenerating ? (
            <Button disabled size="sm" className="flex-1">
              <Loader2 className="animate-spin" />
              正在生成语音，请稍候...
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => generateVoice(true)}
                className="flex-1"
              >
                试听前20个字
              </Button>
              <Button
                size="sm"
                onClick={() => generateVoice(false)}
                className="flex-1"
              >
                生成语音
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
