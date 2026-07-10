function BrandMark({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex gap-1">
        <span className="w-2.5 h-2.5 rounded-full bg-wasabi-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-topaz-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-prune-900" />
      </span>
      <span className="text-xl sm:text-2xl font-bold tracking-tight">Myrokai</span>
    </div>
  );
}

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen min-h-dvh flex flex-col lg:flex-row">
      {/* Panneau marque — visible tablette paysage et desktop */}
      <aside className="hidden lg:flex lg:w-5/12 xl:w-1/2 page-bg-dark text-white flex-col justify-between p-10 xl:p-14">
        <BrandMark className="text-white" />

        <div>
          <h1 className="text-3xl xl:text-4xl font-bold leading-tight">
            Votre espace,
            <span className="text-wasabi-400"> partout</span>
          </h1>
          <p className="mt-4 text-prune-300 text-lg max-w-md">
            Une expérience fluide sur mobile, tablette et ordinateur.
          </p>
        </div>

        <div className="flex gap-3">
          <span className="h-1 flex-1 rounded-full bg-wasabi-400" />
          <span className="h-1 flex-1 rounded-full bg-topaz-500" />
          <span className="h-1 flex-1 rounded-full bg-prune-700" />
        </div>
      </aside>

      {/* Formulaire — mobile first */}
      <main className="flex-1 flex flex-col page-bg-auth">
        {/* En-tête mobile / tablette */}
        <header className="lg:hidden px-4 pt-6 pb-2 sm:px-6 text-center text-white">
          <BrandMark className="justify-center text-white" />
          {subtitle && <p className="text-prune-300 mt-2 text-sm">{subtitle}</p>}
        </header>

        <div className="flex-1 flex items-end sm:items-center justify-center px-4 pb-6 sm:px-6 sm:py-8 lg:p-10">
          <div className="w-full max-w-md">
            {/* En-tête desktop dans le panneau formulaire */}
            <div className="hidden lg:block mb-6">
              {subtitle && <p className="text-prune-500 text-sm">{subtitle}</p>}
            </div>

            <div className="card p-5 sm:p-8 shadow-lg lg:shadow-sm">
              <h2 className="text-xl sm:text-2xl font-bold text-prune-900 mb-6">{title}</h2>
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
