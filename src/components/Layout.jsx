import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

const navItems = [
  {
    to: '/dashboard',
    icon: '⊞',
    labelKey: 'nav.dashboard',
  },
  {
    to: '/catalog',
    icon: '🗂',
    labelKey: 'nav.catalog',
  },
  {
    to: '/items',
    icon: '▤',
    labelKey: 'nav.items',
  },
  {
    to: '/stock',
    icon: '📦',
    labelKey: 'nav.stock',
  },
  {
    to: '/noi',
    icon: '🏢',
    labelKey: 'nav.noi',
  },
]

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg mx-2 text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <span className="text-lg leading-none w-5 text-center flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/50">
        <span className="text-2xl">🔮</span>
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight leading-none">Nostradamus</h1>
          <p className="text-slate-400 text-xs mt-0.5">Purchasing & Forecasting</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto sidebar-scroll">
        <div className="px-4 pb-2">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            {t('nav.menu')}
          </p>
        </div>
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={t(item.labelKey)}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-700/50 p-4 space-y-2">
        <LanguageSwitcher compact />
        {/* User info */}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.username || 'User'}</p>
            <p className="text-slate-400 text-xs truncate">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600/20 hover:text-red-400 transition-colors"
        >
          <span className="text-base">⎋</span>
          <span>{t('nav.logout')}</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-[#0f172a] flex-col h-full">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#0f172a] z-50 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 md:px-6 flex-shrink-0 shadow-sm">
          {/* Mobile menu button */}
          <button
            className="md:hidden mr-3 p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700">
                {user?.username}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}