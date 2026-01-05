import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useRuntimeStore } from '@/stores/runtime'
import { ShowSelector } from '@/components/ShowSelector'
import { StatusBar } from '@/components/StatusBar'
import {
  Lightbulb,
  GitBranch,
  SlidersHorizontal,
  Play,
  Wifi,
  WifiOff,
  Sliders,
} from 'lucide-react'

const navigation = [
  { name: 'Patch', href: '/patch', icon: Lightbulb },
  { name: 'Inputs', href: '/inputs', icon: Sliders },
  { name: 'Graphs', href: '/graphs', icon: GitBranch },
  { name: 'Control Room', href: '/control-room', icon: SlidersHorizontal },
  { name: 'Runtime', href: '/runtime', icon: Play },
]

export function Layout() {
  const location = useLocation()
  const isConnected = useRuntimeStore((s) => s.isConnected)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <div className="flex items-center gap-2 font-semibold">
            <Lightbulb className="h-5 w-5" />
            <span>Let There Be Light</span>
          </div>

          {/* Navigation */}
          <nav className="ml-8 flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Show selector and connection status */}
          <div className="ml-auto flex items-center gap-4">
            <ShowSelector />
            {isConnected ? (
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <Wifi className="h-4 w-4" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <WifiOff className="h-4 w-4" />
                <span>Disconnected</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}
