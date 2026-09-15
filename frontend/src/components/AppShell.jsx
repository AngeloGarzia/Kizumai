import MainLayout from './MainLayout.jsx';

/**
 * Compat : même shell que le reste de l’app (BottomNav), plus un <main> page-container.
 * @deprecated Prefer MainLayout directly when you need a custom main.
 */
export default function AppShell({ children }) {
  return (
    <MainLayout>
      <main className="flex-1 page-container py-5 sm:py-8 lg:py-10">{children}</main>
    </MainLayout>
  );
}
