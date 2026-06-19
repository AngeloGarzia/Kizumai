function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-wasabi-400" />
        <span className="w-2 h-2 rounded-full bg-topaz-500" />
        <span className="w-2 h-2 rounded-full bg-prune-900" />
      </span>
      <span className="text-lg sm:text-xl font-bold text-prune-900">Myrokay</span>
    </div>
  );
}

export default function AppShell({ children, onLogout }) {
  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col">
      <header className="sticky top-0 z-10 header-glass">
        <div className="page-container py-3 sm:py-4 flex items-center justify-between gap-3">
          <BrandMark />

          <button
            type="button"
            onClick={onLogout}
            className="btn-secondary shrink-0 text-xs sm:text-sm"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="flex-1 page-container py-5 sm:py-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
