'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Checkbox } from '@cdlab/ui/components/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@cdlab/ui/components/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@cdlab/ui/components/field'
import { Input } from '@cdlab/ui/components/input'
import { PasswordInput } from '@cdlab/ui/components/password-input'
import { RadioGroup, RadioGroupItem } from '@cdlab/ui/components/radio-group'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import { Switch } from '@cdlab/ui/components/switch'
import { Textarea } from '@cdlab/ui/components/textarea'
import { IKConfirmDialog, IKEmpty } from '@cdlab/ui/IK'
import { useForm } from '@tanstack/react-form'
import {
  Copy,
  Download,
  Pencil,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import * as z from 'zod'
import type { BuiltinApiId } from '@/lib/builtin-apis'
import { BUILTIN_APIS } from '@/lib/builtin-apis'
import type { ApiFormat, BuiltinOverride, CustomApi } from '@/store/useApiStore'
import { useApiStore } from '@/store/useApiStore'

const apiFormSchema = z.object({
  name: z.string().min(1, 'API 名称不能为空'),
  format: z.enum(['openai', 'edge']),
  endpoint: z.url('请输入有效的 URL').min(1, 'API 端点不能为空'),
  apiKey: z.string(),
  authHeaderName: z.string(),
  modelEndpoint: z.string(),
  manual: z.string(),
  maxLength: z.string(),
  enableSegmentation: z.boolean(),
})

type ApiFormValues = z.infer<typeof apiFormSchema>

const EMPTY_FORM: ApiFormValues = {
  name: '',
  format: 'openai',
  endpoint: '',
  apiKey: '',
  authHeaderName: 'Authorization',
  modelEndpoint: '',
  manual: '',
  maxLength: '',
  enableSegmentation: true,
}

const FORMAT_HINTS: Record<
  ApiFormat,
  { endpoint: string; model: string; manual: string }
> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/audio/speech',
    model: 'https://api.openai.com/v1/models',
    manual: 'tts-1, tts-1-hd, gpt-4o-mini-tts',
  },
  edge: {
    endpoint: 'https://api.example.com/api/tts',
    model: 'https://api.example.com/api/voices',
    manual: 'zh-CN-XiaoxiaoNeural, en-US-AriaNeural',
  },
}

function toFormValues(api: CustomApi): ApiFormValues {
  return {
    name: api.name,
    format: api.format,
    endpoint: api.endpoint,
    apiKey: api.apiKey,
    authHeaderName: api.authHeaderName ?? 'Authorization',
    modelEndpoint: api.modelEndpoint,
    manual: api.manual.join(', '),
    maxLength: api.maxLength ? String(api.maxLength) : '',
    enableSegmentation: api.enableSegmentation,
  }
}

function fromFormValues(values: ApiFormValues): Omit<CustomApi, 'id'> {
  return {
    name: values.name.trim(),
    format: values.format,
    endpoint: values.endpoint.trim(),
    apiKey: values.apiKey.trim(),
    authHeaderName: values.authHeaderName.trim() || 'Authorization',
    modelEndpoint: values.modelEndpoint.trim(),
    manual: values.manual
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    maxLength: values.maxLength ? Number(values.maxLength) : undefined,
    enableSegmentation: values.enableSegmentation,
  }
}

function ApiFormDialog({
  open,
  onOpenChange,
  defaultValues,
  editingId,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues: ApiFormValues
  editingId: string | null
  onSubmit: (values: ApiFormValues) => void
}) {
  const [fetching, setFetching] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: apiFormSchema,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value)
    },
  })

  const handleFetchModels = async () => {
    const { modelEndpoint, apiKey, authHeaderName, format } = form.state.values
    if (!modelEndpoint.trim()) {
      toast.error('请先填写模型列表端点')
      return
    }
    setFetching(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      const trimmedHeaderName = authHeaderName.trim()
      if (apiKey.trim() && trimmedHeaderName) {
        headers[trimmedHeaderName] =
          trimmedHeaderName === 'Authorization'
            ? `Bearer ${apiKey.trim()}`
            : apiKey.trim()
      }
      const res = await fetch(modelEndpoint.trim(), {
        method: 'GET',
        headers,
      })
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()

      let models: string[] = []
      if (format === 'openai' && Array.isArray(data.data)) {
        models = data.data
          .map((m: { id?: string; name?: string }) => m.id || m.name || '')
          .filter(Boolean)
      } else if (format === 'edge' && Array.isArray(data)) {
        models = data
          .map(
            (m: { ShortName?: string; name?: string }) =>
              m.ShortName || m.name || '',
          )
          .filter(Boolean)
      }

      if (models.length === 0) {
        toast.warning('未找到可用模型，请检查 API 格式是否匹配')
      } else {
        form.setFieldValue('manual', models.join(', '))
        toast.success(`获取到 ${models.length} 个模型`)
      }
    } catch (e) {
      toast.error('获取模型失败: ' + (e as Error).message)
    } finally {
      setFetching(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingId ? '编辑' : '添加'}自定义 API</DialogTitle>
          <DialogDescription>
            支持 OpenAI 格式和 Edge API
            格式。格式决定请求参数结构和语速/语调控制是否可用。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-16rem)]">
          <form
            ref={formRef}
            id="api-form"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <FieldGroup>
              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>API 名称</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="例如: 我的自定义 TTS"
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="format"
                children={(field) => (
                  <Field>
                    <FieldLabel>API 格式</FieldLabel>
                    <RadioGroup
                      name={field.name}
                      value={field.state.value}
                      onValueChange={(v) => {
                        field.handleChange(v as ApiFormat)
                        form.setFieldValue('endpoint', '')
                        form.setFieldValue('modelEndpoint', '')
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="openai" id="format-openai" />
                        <FieldLabel
                          htmlFor="format-openai"
                          className="font-normal"
                        >
                          OpenAI 格式
                        </FieldLabel>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="edge" id="format-edge" />
                        <FieldLabel
                          htmlFor="format-edge"
                          className="font-normal"
                        >
                          Edge API 格式
                        </FieldLabel>
                      </div>
                    </RadioGroup>
                  </Field>
                )}
              />

              <form.Field
                name="endpoint"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>API 端点 URL</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder={
                          FORMAT_HINTS[form.state.values.format].endpoint
                        }
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="modelEndpoint"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>模型列表</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id={field.name}
                        name={field.name}
                        className="flex-1"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={
                          FORMAT_HINTS[form.state.values.format].model
                        }
                      />
                      <Button
                        variant="outline"
                        onClick={handleFetchModels}
                        disabled={fetching}
                        className="shrink-0"
                      >
                        {fetching ? '获取中...' : '获取模型'}
                      </Button>
                    </div>
                  </Field>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <form.Field
                  name="authHeaderName"
                  children={(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        认证 Header 名称（可选）
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Authorization,部分API使用x-api-key等自定义Header"
                      />
                    </Field>
                  )}
                />

                <form.Field
                  name="apiKey"
                  children={(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        API 密钥（可选）
                      </FieldLabel>
                      <PasswordInput
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Header为Authorization时自动添加Bearer前缀"
                      />
                    </Field>
                  )}
                />
              </div>

              <form.Field
                name="manual"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>讲述人列表</FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={2}
                      placeholder={
                        FORMAT_HINTS[form.state.values.format].manual
                      }
                    />
                    <FieldDescription>
                      逗号分隔，无法自动获取时可手动输入，点击「获取模型」会自动填入
                    </FieldDescription>
                  </Field>
                )}
              />

              <form.Field
                name="maxLength"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>最大请求字符数</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="留空使用默认限制（如 4096）"
                      min={1}
                    />
                  </Field>
                )}
              />

              <form.Field
                name="enableSegmentation"
                children={(field) => (
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor={field.name}>启用自动分段</FieldLabel>
                      <FieldDescription>
                        关闭后超长文本将被截断而非分段发送
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id={field.name}
                      name={field.name}
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" form="api-form">
            {editingId ? '更新' : '保存'} API
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SavedApisList({
  onEdit,
  onSelectApi,
}: {
  onEdit: (id: string) => void
  onSelectApi: (id: string | null) => void
}) {
  const { customApis, removeApi, addApi } = useApiStore()
  const [batchMode, setBatchMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<
    { type: 'single'; id: string } | { type: 'batch' } | null
  >(null)

  const apiList = Object.values(customApis)

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(apiList.map((a) => a.id)) : new Set())
  }

  const exitBatch = () => {
    setBatchMode(false)
    setSelected(new Set())
  }

  const handleBatchDelete = () => {
    if (selected.size === 0) {
      toast.warning('请先选择要删除的 API')
      return
    }
    setPendingDelete({ type: 'batch' })
    setConfirmOpen(true)
  }

  const handleDelete = (id: string) => {
    setPendingDelete({ type: 'single', id })
    setConfirmOpen(true)
  }

  const executeDelete = () => {
    if (!pendingDelete) return
    if (pendingDelete.type === 'single') {
      const name = customApis[pendingDelete.id]?.name ?? pendingDelete.id
      removeApi(pendingDelete.id)
      onSelectApi(null)
      toast.success(`已删除 API: ${name}`)
    } else {
      selected.forEach((id) => removeApi(id))
      onSelectApi(null)
      toast.success(`已删除 ${selected.size} 个 API`)
      exitBatch()
    }
    setPendingDelete(null)
  }

  const handleCopy = (id: string) => {
    const api = customApis[id]
    if (!api) return
    addApi({ ...api, name: `${api.name} (复制)` })
    toast.success(`已复制: ${api.name}`)
  }

  const handleExport = () => {
    if (apiList.length === 0) {
      toast.warning('没有自定义 API 可导出')
      return
    }
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: '1.0',
            timestamp: new Date().toISOString(),
            apis: customApis,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = `bytts-apis-${new Date().toISOString().slice(0, 10)}.json`
    a.href = url
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
    toast.success(`已导出 ${apiList.length} 个 API 配置`)
  }

  const handleImport = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          if (!data.apis || typeof data.apis !== 'object')
            throw new Error('无效的 API 配置格式')
          const entries = Object.values(data.apis) as CustomApi[]
          if (entries.length === 0) {
            toast.warning('文件中没有 API 配置')
            return
          }
          let added = 0
          let updated = 0
          entries.forEach((api) => {
            const existing = apiList.find(
              (a) => a.name === api.name && a.endpoint === api.endpoint,
            )
            if (existing) {
              useApiStore.getState().updateApi(existing.id, api)
              updated++
            } else {
              addApi({ ...api })
              added++
            }
          })
          toast.success(`导入完成：新增 ${added} 个，更新 ${updated} 个`)
        } catch (err) {
          toast.error('导入失败: ' + (err as Error).message)
        }
      }
      reader.readAsText(file)
    },
    [addApi, apiList],
  )

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({
    onDrop: handleImport,
    accept: { 'application/json': ['.json'] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div {...getRootProps()} className="flex flex-col gap-3 relative">
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="size-8" />
            <p className="text-sm font-medium">释放以导入 API 配置</p>
          </div>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          已保存的 API
          {apiList.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {apiList.length}
            </Badge>
          )}
        </span>
        <div className="flex gap-1">
          {!batchMode ? (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleExport}
                title="导出配置"
              >
                <Download />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={openFilePicker}
                title="导入配置"
              >
                <Upload />
              </Button>
              {apiList.length > 0 && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setBatchMode(true)}
                  title="批量删除"
                >
                  <Trash2 />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchDelete}
              >
                删除选中 ({selected.size})
              </Button>
              <Button variant="outline" size="sm" onClick={exitBatch}>
                <X /> 取消
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Batch select-all */}
      {batchMode && apiList.length > 0 && (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={
              selected.size === apiList.length
                ? true
                : selected.size > 0
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
          全选
        </label>
      )}

      {/* List */}
      {apiList.length === 0 ? (
        <IKEmpty title="暂无自定义 API" showIcon={false} />
      ) : (
        <div className="flex flex-col gap-2">
          {apiList.map((api) => (
            <div
              key={api.id}
              className="flex items-start gap-4 rounded-lg border p-4"
            >
              {batchMode && (
                <Checkbox
                  className="mt-0.5 shrink-0"
                  checked={selected.has(api.id)}
                  onCheckedChange={() => toggleSelect(api.id)}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {api.name}
                  </span>
                  <Badge
                    variant={api.format === 'openai' ? 'default' : 'secondary'}
                    className="shrink-0"
                  >
                    {api.format === 'openai' ? 'OpenAI' : 'Edge'}
                  </Badge>
                  {!api.enableSegmentation && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      不分段
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {api.endpoint}
                </p>
                {api.manual.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {api.manual.length} 个讲述人
                  </p>
                )}
                {api.maxLength && (
                  <p className="text-xs text-muted-foreground">
                    最大 {api.maxLength} 字符
                  </p>
                )}
              </div>
              {!batchMode && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(api.id)}
                    title="编辑"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleCopy(api.id)}
                    title="复制"
                  >
                    <Copy />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(api.id)}
                    title="删除"
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <IKConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认删除"
        description={
          pendingDelete?.type === 'single'
            ? `确定要删除「${customApis[pendingDelete.id]?.name ?? pendingDelete.id}」吗？此操作不可撤销。`
            : `确定要删除选中的 ${selected.size} 个 API 吗？此操作不可撤销。`
        }
        confirmText="删除"
        onConfirm={executeDelete}
      />
    </div>
  )
}

function BuiltinOverrideDialog({
  id,
  open,
  onOpenChange,
}: {
  id: BuiltinApiId | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { builtinOverrides, setBuiltinOverride, removeBuiltinOverride } =
    useApiStore()

  const base = id ? BUILTIN_APIS[id] : null
  const current = id ? (builtinOverrides[id] ?? {}) : {}

  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [authHeaderName, setAuthHeaderName] = useState('')
  const [maxLength, setMaxLength] = useState('')
  const [splitLength, setSplitLength] = useState('')

  useEffect(() => {
    if (open && base) {
      setEndpoint(current.endpoint ?? base.endpoint)
      setApiKey(current.apiKey ?? '')
      setAuthHeaderName(current.authHeaderName ?? 'Authorization')
      setMaxLength(String(current.maxLength ?? base.maxLength))
      setSplitLength(String(current.splitLength ?? base.splitLength))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id])

  if (!id || !base) return null

  const handleSave = () => {
    const override: BuiltinOverride = {}
    const trimmedEndpoint = endpoint.trim()
    if (trimmedEndpoint !== base.endpoint) override.endpoint = trimmedEndpoint
    const trimmedKey = apiKey.trim()
    if (trimmedKey) override.apiKey = trimmedKey
    const trimmedHeaderName = authHeaderName.trim()
    if (trimmedHeaderName) override.authHeaderName = trimmedHeaderName
    const ml = Number(maxLength)
    if (!isNaN(ml) && ml > 0 && ml !== base.maxLength) override.maxLength = ml
    const sl = Number(splitLength)
    if (!isNaN(sl) && sl > 0 && sl !== base.splitLength)
      override.splitLength = sl

    if (Object.keys(override).length > 0) {
      setBuiltinOverride(id, override)
    } else {
      removeBuiltinOverride(id)
    }
    toast.success(`已更新 ${base.label} 配置`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑 {base.label}</DialogTitle>
          <DialogDescription>
            修改内置 API 配置，点击还原可恢复默认值。
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>端点 URL</FieldLabel>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder={base.endpoint}
            />
            <FieldDescription>默认：{base.endpoint}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>API 密钥（可选）</FieldLabel>
            <PasswordInput
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Bearer Token"
            />
          </Field>

          <Field>
            <FieldLabel>认证 Header 名称</FieldLabel>
            <Input
              value={authHeaderName}
              onChange={(e) => setAuthHeaderName(e.target.value)}
              onBlur={() => setAuthHeaderName((prev) => prev)}
              placeholder="默认 Authorization，部分 API 使用 x-api-key 等自定义 Header"
            />
          </Field>

          <Field>
            <FieldLabel>最大字符数</FieldLabel>
            <Input
              type="number"
              value={maxLength}
              onChange={(e) => setMaxLength(e.target.value)}
              min={1}
            />
            <FieldDescription>默认：{base.maxLength}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>分段长度</FieldLabel>
            <Input
              type="number"
              value={splitLength}
              onChange={(e) => setSplitLength(e.target.value)}
              min={1}
            />
            <FieldDescription>默认：{base.splitLength}</FieldDescription>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ApiManagerDialog({
  onApiChange,
}: {
  onApiChange?: (id: string | null) => void
}) {
  const {
    customApis,
    builtinOverrides,
    addApi,
    updateApi,
    removeBuiltinOverride,
  } = useApiStore()
  const [listOpen, setListOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formDefaults, setFormDefaults] = useState<ApiFormValues>(EMPTY_FORM)
  const [builtinEditId, setBuiltinEditId] = useState<BuiltinApiId | null>(null)
  const [builtinEditOpen, setBuiltinEditOpen] = useState(false)

  const openBuiltinEdit = (id: BuiltinApiId) => {
    setBuiltinEditId(id)
    setBuiltinEditOpen(true)
  }

  const handleRestoreBuiltin = (id: BuiltinApiId) => {
    removeBuiltinOverride(id)
    toast.success(`已还原 ${BUILTIN_APIS[id].label} 默认配置`)
  }

  const openNewForm = () => {
    setEditingId(null)
    setFormDefaults(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEditForm = (id: string) => {
    const api = customApis[id]
    if (!api) return
    setEditingId(id)
    setFormDefaults(toFormValues(api))
    setFormOpen(true)
  }

  const handleFormSubmit = (values: ApiFormValues) => {
    if (editingId) {
      updateApi(editingId, fromFormValues(values))
      toast.success(`已更新 API: ${values.name}`)
    } else {
      addApi(fromFormValues(values))
      toast.success(`已添加 API: ${values.name}`)
    }
    setFormOpen(false)
    setEditingId(null)
  }

  return (
    <>
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon-sm" title="管理自定义 API">
            <Settings />
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理自定义 API</DialogTitle>
            <DialogDescription className="sr-only">
              在这里你可以添加、编辑和删除自定义 API 配置，以及修改内置 API
              的端点和密钥等设置。
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pr-3">
            {/* Built-in APIs */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">内置 API</span>
              {(
                Object.entries(BUILTIN_APIS) as [
                  BuiltinApiId,
                  (typeof BUILTIN_APIS)[BuiltinApiId],
                ][]
              ).map(([id, api]) => {
                const override = builtinOverrides[id]
                const hasOverride = override && Object.keys(override).length > 0
                return (
                  <div
                    key={id}
                    className="flex items-start gap-4 rounded-lg border p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{api.label}</span>
                        <Badge
                          variant={
                            api.format === 'openai' ? 'default' : 'secondary'
                          }
                          className="shrink-0"
                        >
                          {api.format === 'openai' ? 'OpenAI' : 'Edge'}
                        </Badge>
                        {hasOverride && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            已修改
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {override?.endpoint ?? api.endpoint}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openBuiltinEdit(id)}
                        title="编辑"
                      >
                        <Pencil />
                      </Button>
                      {hasOverride && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRestoreBuiltin(id)}
                          title="还原默认"
                        >
                          <RotateCcw />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <SavedApisList
              onEdit={openEditForm}
              onSelectApi={(id) => onApiChange?.(id)}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">关闭</Button>
            </DialogClose>
            <Button onClick={openNewForm}>添加自定义 API</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApiFormDialog
        key={editingId ?? 'new'}
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) setEditingId(null)
        }}
        defaultValues={formDefaults}
        editingId={editingId}
        onSubmit={handleFormSubmit}
      />

      <BuiltinOverrideDialog
        id={builtinEditId}
        open={builtinEditOpen}
        onOpenChange={(v) => {
          setBuiltinEditOpen(v)
          if (!v) setBuiltinEditId(null)
        }}
      />
    </>
  )
}
