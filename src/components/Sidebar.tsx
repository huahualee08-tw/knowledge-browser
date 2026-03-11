import type { Category } from '../types'
import { KB_FOLDERS } from '../lib/api'

const CATEGORY_ICONS: Record<string, string> = {
  'AI資訊': '🤖',
  '程式開發': '💻',
  'OpenClaw': '🦞',
  'YouTube_影片摘要': '🎬',
  '個人成長': '🌱',
  '投資理財': '💰',
  '其他': '📁',
}

interface SidebarProps {
  categories: string[]
  selectedCategory: Category
  onSelectCategory: (cat: Category) => void
  fileCounts: Record<string, number>
  totalCount: number
}

export function Sidebar({
  categories,
  selectedCategory,
  onSelectCategory,
  fileCounts,
  totalCount,
}: SidebarProps) {
  // Show known KB folders first (in PRD order), then any others
  const ordered = [
    ...KB_FOLDERS.filter((f) => categories.includes(f)),
    ...categories.filter((c) => !KB_FOLDERS.includes(c)),
  ]

  return (
    <aside className="flex flex-col w-56 min-w-[14rem] bg-surface-800 border-r border-surface-600 h-full overflow-y-auto">
      <div className="px-4 pt-5 pb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">分類</p>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {/* All */}
        <CategoryItem
          icon="📚"
          label="全部"
          count={totalCount}
          active={selectedCategory === 'all'}
          onClick={() => onSelectCategory('all')}
        />

        <div className="my-2 border-t border-surface-600" />

        {ordered.map((cat) => (
          <CategoryItem
            key={cat}
            icon={CATEGORY_ICONS[cat] ?? '📁'}
            label={cat}
            count={fileCounts[cat] ?? 0}
            active={selectedCategory === cat}
            onClick={() => onSelectCategory(cat)}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-surface-600">
        <p className="text-xs text-gray-600">Phase 1 MVP</p>
      </div>
    </aside>
  )
}

interface CategoryItemProps {
  icon: string
  label: string
  count: number
  active: boolean
  onClick: () => void
}

function CategoryItem({ icon, label, count, active, onClick }: CategoryItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group ${
        active
          ? 'bg-blue-600/20 text-blue-300'
          : 'text-gray-400 hover:bg-surface-700 hover:text-gray-200'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className="text-base">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`text-xs tabular-nums ml-2 shrink-0 ${
          active ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-500'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
