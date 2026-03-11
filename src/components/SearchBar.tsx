interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  user: { name: string; email: string; picture?: string } | null
  onLogout: () => void
}

export function SearchBar({ value, onChange, user, onLogout }: SearchBarProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-surface-800 border-b border-surface-600 shrink-0">
      {/* Search */}
      <div className="flex-1 relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="搜尋知識庫..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface-700 text-gray-200 placeholder-gray-500 text-sm rounded-lg pl-9 pr-4 py-2 border border-surface-600 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* User */}
      {user && (
        <div className="flex items-center gap-2.5 shrink-0">
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-8 h-8 rounded-full ring-1 ring-surface-600"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
              {user.name[0]}
            </div>
          )}
          <span className="text-sm text-gray-300 hidden sm:block">{user.name}</span>
          <button
            onClick={onLogout}
            title="登出"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-surface-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}
    </header>
  )
}
