'use client'

import { Button } from '@cdlab/ui/components/button'
import { ButtonGroup } from '@cdlab/ui/components/button-group'
import { Card, CardContent } from '@cdlab/ui/components/card'
import { Checkbox } from '@cdlab/ui/components/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@cdlab/ui/components/input-group'
import { Label } from '@cdlab/ui/components/label'
import { Skeleton } from '@cdlab/ui/components/skeleton'
import { IKEmpty } from '@cdlab/ui/IK/IKEmpty'
import { cn } from '@cdlab/ui/lib/utils'
import { format as formatDate } from 'date-fns'
import {
  ArrowDown,
  Calendar,
  Copy,
  EllipsisVertical,
  Info,
  Pencil,
  Plus,
  Search,
  Trash2,
  // User,
  Video,
} from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreateProjectDialog } from '@/components/editor/dialogs/create-project-dialog'
import { DeleteProjectDialog } from '@/components/editor/dialogs/delete-project-dialog'
import { MigrationDialog } from '@/components/editor/dialogs/migration-dialog'
import { ProjectInfoDialog } from '@/components/editor/dialogs/project-info-dialog'
import { RenameProjectDialog } from '@/components/editor/dialogs/rename-project-dialog'
import {
  LanguageSelector as LanguageToggle,
  ThemeToggle,
} from '@/components/layout'
import { useEditor } from '@/hooks/use-editor'
import { Link, useRouter } from '@/lib/navigation'
import { formatTimeCode } from '@/lib/time'
import type {
  TProjectMetadata,
  TProjectSortOption,
  TProjectType,
} from '@/types/project'
import { StorageIndicator } from './storage-indicator'
import { useProjectsStore } from './store'

const formatProjectDuration = ({
  duration,
}: {
  duration: number | undefined
}): string | null => {
  if (duration === undefined) {
    return null
  }

  const format = duration >= 3600 ? 'HH:MM:SS' : 'MM:SS'
  return formatTimeCode({ timeInSeconds: duration, format })
}

const groupProjectsByMonth = ({
  projects,
  sortKey,
}: {
  projects: TProjectMetadata[]
  sortKey: 'createdAt' | 'updatedAt' | 'name' | 'duration'
}): { month: string; projects: TProjectMetadata[] }[] => {
  const dateKey =
    sortKey === 'createdAt' || sortKey === 'updatedAt' ? sortKey : 'createdAt'
  const groups = new Map<string, TProjectMetadata[]>()

  for (const project of projects) {
    const month = formatDate(new Date(project[dateKey]), 'yyyy-MM')
    const list = groups.get(month)
    if (list) {
      list.push(project)
    } else {
      groups.set(month, [project])
    }
  }

  return Array.from(groups.entries()).map(([month, items]) => ({
    month,
    projects: items,
  }))
}

export default function ProjectsPage() {
  const { searchQuery, sortKey, sortOrder } = useProjectsStore()
  const editor = useEditor()

  useEffect(() => {
    if (!editor.project.getIsInitialized()) {
      void editor.project.loadAllProjects()
    }
  }, [editor.project])

  const sortOption: TProjectSortOption = `${sortKey}-${sortOrder}`
  const projectsToDisplay = editor.project.getFilteredAndSortedProjects({
    searchQuery,
    sortOption,
  })

  const isLoading = editor.project.getIsLoading()
  const isInitialized = editor.project.getIsInitialized()
  const allProjectIds = projectsToDisplay.map((p) => p.id)
  const groupedProjects = groupProjectsByMonth({
    projects: projectsToDisplay,
    sortKey,
  })

  return (
    <div className="min-h-screen">
      <MigrationDialog />
      <ProjectsHeader />
      <ProjectsToolbar projectIds={allProjectIds} />
      <main className="mx-auto px-4 pt-2 pb-6 flex flex-col gap-6">
        {isLoading || !isInitialized ? (
          <ProjectsSkeleton />
        ) : projectsToDisplay.length === 0 ? (
          <EmptyState />
        ) : (
          groupedProjects.map((group) => (
            <MonthGroup key={group.month} group={group}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] p-0.5 gap-6">
                {group.projects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    allProjectIds={allProjectIds}
                  />
                ))}
              </div>
            </MonthGroup>
          ))
        )}
      </main>
    </div>
  )
}

function MonthGroup({
  group,
  children,
}: {
  group: { month: string; projects: TProjectMetadata[] }
  children: React.ReactNode
}) {
  const { selectedProjectIds, setSelectedProjects } = useProjectsStore()
  const groupIds = group.projects.map((p) => p.id)
  const selectedInGroup = groupIds.filter((id) =>
    selectedProjectIds.includes(id),
  )
  const isAllSelected =
    groupIds.length > 0 && selectedInGroup.length === groupIds.length
  const hasSomeSelected =
    selectedInGroup.length > 0 && selectedInGroup.length < groupIds.length

  const handleToggle = (checked: boolean) => {
    if (checked) {
      const merged = new Set([...selectedProjectIds, ...groupIds])
      setSelectedProjects({ projectIds: Array.from(merged) })
    } else {
      const remaining = selectedProjectIds.filter(
        (id) => !groupIds.includes(id),
      )
      setSelectedProjects({ projectIds: remaining })
    }
  }

  return (
    <section className="px-4">
      <Label
        className="flex items-center gap-2 mb-3 cursor-pointer"
        htmlFor={`month-select-${group.month}`}
      >
        <Checkbox
          id={`month-select-${group.month}`}
          checked={isAllSelected}
          indeterminate={!isAllSelected && hasSomeSelected}
          onCheckedChange={(checked) => handleToggle(checked === true)}
        />
        <span className="text-sm font-medium text-muted-foreground">
          {group.month}
        </span>
      </Label>
      {children}
    </section>
  )
}

function ProjectsHeader() {
  const t = useTranslations()

  return (
    <header className="sticky top-0 z-20 px-8 flex flex-col gap-2">
      <div className="flex items-center justify-between h-16 pt-2">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="https://wcd.pages.dev/logo.png"
                alt="Cutia Logo"
                width={24}
                height={24}
              />
              <span className="text-base font-bold tracking-tight">ByCut</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <StorageIndicator />
          {/* <Link href="/characters">
            <Button variant="outline">
              <User className="size-4" />
              <span className="hidden sm:inline">{t('nav.characters')}</span>
            </Button>
          </Link> */}
          <NewProjectButton />
        </div>
      </div>
    </header>
  )
}

function ProjectsToolbar({ projectIds }: { projectIds: string[] }) {
  const t = useTranslations()
  const {
    selectedProjectIds,
    sortKey,
    sortOrder,
    setSortKey,
    setSortOrder,
    setSelectedProjects,
    clearSelectedProjects,
  } = useProjectsStore()

  const selectedProjectCount = selectedProjectIds.length
  const hasSelection = selectedProjectCount > 0
  const isAllSelected =
    projectIds.length > 0 && selectedProjectCount === projectIds.length
  const hasSomeSelected =
    selectedProjectCount > 0 && selectedProjectCount < projectIds.length

  const handleSelectAll = ({ checked }: { checked: boolean }) => {
    if (checked) {
      setSelectedProjects({ projectIds })
      return
    }
    clearSelectedProjects()
  }

  if (hasSelection) {
    return (
      <div className="sticky top-16 z-10 flex items-center gap-2 px-6 h-14 pt-2">
        <Label
          className="flex items-center gap-3 cursor-pointer px-2"
          htmlFor="select-all-projects"
        >
          <Checkbox
            id="select-all-projects"
            checked={isAllSelected}
            indeterminate={!isAllSelected && hasSomeSelected}
            onCheckedChange={(checked) =>
              handleSelectAll({ checked: checked === true })
            }
          />
          <span className="text-muted-foreground hidden md:block">
            {t('common.selectAll')}
          </span>
        </Label>

        <div className="h-4 w-px bg-border/50" />

        <span className="text-sm text-muted-foreground">
          {t('common.selectedCount', { count: selectedProjectCount })}
        </span>

        <div className="h-4 w-px bg-border/50" />

        <ProjectActions />
      </div>
    )
  }

  return (
    <div className="sticky top-16 z-10 flex items-center justify-between px-6 h-14 pt-2">
      <div className="flex items-center gap-2 pl-2">
        <SearchBar />
        <ButtonGroup>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" className="w-18" />}
            >
              {t(
                sortKey === 'createdAt'
                  ? 'common.created'
                  : sortKey === 'updatedAt'
                    ? 'common.modified'
                    : sortKey === 'name'
                      ? 'common.name'
                      : 'common.duration',
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuCheckboxItem
                closeOnClick
                checked={sortKey === 'createdAt'}
                onCheckedChange={() => setSortKey({ sortKey: 'createdAt' })}
              >
                {t('common.created')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                closeOnClick
                checked={sortKey === 'updatedAt'}
                onCheckedChange={() => setSortKey({ sortKey: 'updatedAt' })}
              >
                {t('common.modified')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                closeOnClick
                checked={sortKey === 'name'}
                onCheckedChange={() => setSortKey({ sortKey: 'name' })}
              >
                {t('common.name')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                closeOnClick
                checked={sortKey === 'duration'}
                onCheckedChange={() => setSortKey({ sortKey: 'duration' })}
              >
                {t('common.duration')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setSortOrder({
                sortOrder: sortOrder === 'asc' ? 'desc' : 'asc',
              })
            }
            aria-label={
              sortOrder === 'asc'
                ? t('common.ascending')
                : t('common.descending')
            }
          >
            <ArrowDown
              className={cn(
                'size-3.5 transition-transform',
                sortOrder === 'asc' && 'rotate-180',
              )}
            />
          </Button>
        </ButtonGroup>
      </div>
    </div>
  )
}

function SearchBar({ className }: { className?: string }) {
  const t = useTranslations()
  const { searchQuery, setSearchQuery } = useProjectsStore()

  return (
    <div className={cn('relative', className)}>
      <InputGroup>
        <InputGroupInput
          placeholder={t('common.searchPlaceholder')}
          value={searchQuery}
          onChange={(event) => setSearchQuery({ query: event.target.value })}
        />
        <InputGroupAddon align="inline-start">
          <Search className="size-4" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

const PROJECT_ACTIONS = [
  {
    id: 'duplicate',
    labelKey: 'common.duplicate',
    icon: Copy,
    variant: 'outline' as const,
  },
  {
    id: 'delete',
    labelKey: 'common.delete',
    icon: Trash2,
    variant: 'destructive' as const,
  },
] as const

async function deleteProjects({
  editor,
  ids,
}: {
  editor: ReturnType<typeof useEditor>
  ids: string[]
}) {
  await editor.project.deleteProjects({ ids })
}

async function duplicateProjects({
  editor,
  ids,
}: {
  editor: ReturnType<typeof useEditor>
  ids: string[]
}) {
  await editor.project.duplicateProjects({ ids })
}

async function renameProject({
  editor,
  id,
  name,
}: {
  editor: ReturnType<typeof useEditor>
  id: string
  name: string
}) {
  await editor.project.renameProject({ id, name })
}

function ProjectActions() {
  const t = useTranslations()
  const editor = useEditor()
  const { selectedProjectIds, clearSelectedProjects } = useProjectsStore()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const savedProjects = editor.project.getSavedProjects()
  const selectedProjectNames = savedProjects
    .filter((project) => selectedProjectIds.includes(project.id))
    .map((project) => project.name)

  const handleDuplicate = async () => {
    await duplicateProjects({ editor, ids: selectedProjectIds })
    clearSelectedProjects()
  }

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    await deleteProjects({ editor, ids: selectedProjectIds })
    clearSelectedProjects()
    setIsDeleteDialogOpen(false)
  }

  const actionHandlers: Record<string, () => void> = {
    duplicate: handleDuplicate,
    delete: handleDeleteClick,
  }

  return (
    <>
      <div className="flex items-center gap-2.5">
        {PROJECT_ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant={action.variant}
            onClick={actionHandlers[action.id]}
          >
            <action.icon className="size-4" />
            <span className="hidden sm:inline">{t(action.labelKey)}</span>
          </Button>
        ))}
        <Button variant="outline" onClick={() => clearSelectedProjects()}>
          {t('common.cancel')}
        </Button>
      </div>

      <DeleteProjectDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        projectNames={selectedProjectNames}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}

function NewProjectButton() {
  const t = useTranslations()
  const editor = useEditor()
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleCreateProject = async (name: string, type: TProjectType) => {
    setIsDialogOpen(false)
    const projectId = await editor.project.createNewProject({ name, type })
    router.push({
      pathname: '/editor',
      query: { projectId },
    })
  }

  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)}>
        <span className="text-sm font-medium hidden md:block">
          {t('projects.new')}
        </span>
        <span className="text-sm font-medium block md:hidden">
          {t('common.new')}
        </span>
      </Button>
      <CreateProjectDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleCreateProject}
      />
    </>
  )
}

function ProjectItem({
  project,
  allProjectIds,
}: {
  project: TProjectMetadata
  allProjectIds: string[]
}) {
  const t = useTranslations()
  const { selectedProjectIds, setProjectSelected, selectProjectRange } =
    useProjectsStore()
  const selectedProjectIdSet = new Set(selectedProjectIds)
  const isSelected = selectedProjectIdSet.has(project.id)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false)
  const editor = useEditor()
  const durationLabel = formatProjectDuration({ duration: project.duration })

  const handleCheckboxChange = ({
    checked,
    shiftKey,
  }: {
    checked: boolean
    shiftKey: boolean
  }) => {
    if (shiftKey && checked) {
      selectProjectRange({ projectId: project.id, allProjectIds })
      return
    }
    setProjectSelected({ projectId: project.id, isSelected: checked })
  }

  return (
    <div className="group relative">
      <Link
        href={{ pathname: '/editor', query: { projectId: project.id } }}
        className="block"
      >
        <Card className="group relative gap-2 overflow-hidden p-3 transition-all duration-300 hover:ring-2 hover:ring-primary border-0">
          <div className="bg-muted relative aspect-video">
            <div className="relative aspect-4/3 overflow-hidden rounded-xs bg-background">
              {project.thumbnail ? (
                <Image
                  src={project.thumbnail}
                  alt={t('projects.thumbnail')}
                  fill
                  className="object-contain transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Video className="text-muted-foreground size-12 shrink-0" />
                </div>
              )}
            </div>

            {durationLabel && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-sm">
                {durationLabel}
              </div>
            )}
          </div>

          <CardContent className="flex items-center justify-between gap-2 px-0">
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="group-hover:text-foreground/90 line-clamp-2 text-sm leading-snug font-medium">
                {project.name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-foreground/50 transition-all duration-300 group-hover:text-foreground/70">
                <Calendar className="size-3.5" />
                <span>
                  {t('projects.createdDate', {
                    date: formatDate(project.createdAt, 'yyyy-MM-dd HH:mm:ss'),
                  })}
                </span>
              </div>
            </div>
            <DropdownMenu
              open={isDropdownOpen}
              onOpenChange={setIsDropdownOpen}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('editor.menu.title')}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                      }
                    }}
                  />
                }
              >
                <EllipsisVertical className="size-4 text-foreground/50 transition-colors duration-300 group-hover:text-foreground/90" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48"
                align="end"
                onClick={(event) => event.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={() => {
                    setIsRenameDialogOpen(true)
                    setIsDropdownOpen(false)
                  }}
                >
                  <Pencil />
                  {t('common.rename')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await duplicateProjects({ editor, ids: [project.id] })
                    setIsDropdownOpen(false)
                  }}
                >
                  <Copy />
                  {t('common.duplicate')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setIsInfoDialogOpen(true)
                    setIsDropdownOpen(false)
                  }}
                >
                  <Info />
                  {t('common.info')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setIsDeleteDialogOpen(true)
                    setIsDropdownOpen(false)
                  }}
                >
                  <Trash2 />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      </Link>

      <Checkbox
        checked={isSelected}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          handleCheckboxChange({
            checked: !isSelected,
            shiftKey: event.shiftKey,
          })
        }}
        onCheckedChange={() => {}}
        className={`absolute z-10 top-5 left-5 ${
          isSelected || isDropdownOpen
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100'
        }`}
      />

      <RenameProjectDialog
        isOpen={isRenameDialogOpen}
        onOpenChange={setIsRenameDialogOpen}
        projectName={project.name}
        onConfirm={async (newName) => {
          await renameProject({ editor, id: project.id, name: newName })
          setIsRenameDialogOpen(false)
        }}
      />

      <DeleteProjectDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        projectNames={[project.name]}
        onConfirm={async () => {
          await deleteProjects({ editor, ids: [project.id] })
          setIsDeleteDialogOpen(false)
        }}
      />

      <ProjectInfoDialog
        isOpen={isInfoDialogOpen}
        onOpenChange={setIsInfoDialogOpen}
        project={project}
      />
    </div>
  )
}

function ProjectsSkeleton() {
  const skeletonIds = Array.from(
    { length: 12 },
    (_, index) => `skeleton-${index}`,
  )

  return (
    <section className="px-4">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="bg-muted/50 h-4 w-4" />
        <Skeleton className="bg-muted/50 h-4 w-20" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] p-0.5 gap-6">
        {skeletonIds.map((skeletonId) => (
          <Card
            key={skeletonId}
            className="bg-background overflow-hidden border-none p-0"
          >
            <div className="bg-muted relative aspect-video">
              <div className="absolute inset-0">
                <Skeleton className="bg-muted/50 size-full" />
              </div>
            </div>
            <CardContent className="flex flex-col gap-2 px-0 pt-4">
              <Skeleton className="bg-muted/50 h-4 w-3/4" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="bg-muted/50 size-3.5" />
                <Skeleton className="bg-muted/50 h-3.5 w-36" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function EmptyState() {
  const t = useTranslations()
  const { searchQuery, setSearchQuery } = useProjectsStore()
  const router = useRouter()
  const editor = useEditor()
  const savedProjects = editor.project.getSavedProjects()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleCreateProject = async (name: string, type: TProjectType) => {
    try {
      setIsDialogOpen(false)
      const projectId = await editor.project.createNewProject({ name, type })
      router.push({
        pathname: '/editor',
        query: { projectId },
      })
    } catch (error) {
      toast.error(t('projects.createFailed'), {
        description:
          error instanceof Error ? error.message : t('common.pleaseTryAgain'),
      })
    }
  }

  if (savedProjects.length > 0) {
    return (
      <IKEmpty
        icon={Search}
        title={t('common.noResults')}
        description={t('projects.searchNoResults', { query: searchQuery })}
        className="py-16"
      >
        <Button
          onClick={() => setSearchQuery({ query: '' })}
          variant="outline"
          size="lg"
        >
          {t('projects.clearSearch')}
        </Button>
      </IKEmpty>
    )
  }

  return (
    <IKEmpty
      icon={Video}
      title={t('projects.noProjects')}
      description={t('projects.createFirstDesc')}
      className="py-16"
    >
      <Button size="lg" onClick={() => setIsDialogOpen(true)}>
        <Plus />
        {t('projects.createFirst')}
      </Button>
      <CreateProjectDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleCreateProject}
      />
    </IKEmpty>
  )
}
