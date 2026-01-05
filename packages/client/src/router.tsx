import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'

// Lazy load page components
import { lazy, Suspense } from 'react'

const PatchPage = lazy(() => import('@/pages/Patch'))
const InputsPage = lazy(() => import('@/pages/Inputs'))
const GraphsPage = lazy(() => import('@/pages/Graphs'))
const GraphEditorPage = lazy(() => import('@/pages/GraphEditor'))
const ControlRoomPage = lazy(() => import('@/pages/ControlRoom'))
const RuntimePage = lazy(() => import('@/pages/Runtime'))

function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  )
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/patch" replace />,
      },
      {
        path: 'patch',
        element: (
          <LazyPage>
            <PatchPage />
          </LazyPage>
        ),
      },
      {
        path: 'inputs',
        element: (
          <LazyPage>
            <InputsPage />
          </LazyPage>
        ),
      },
      {
        path: 'graphs',
        element: (
          <LazyPage>
            <GraphsPage />
          </LazyPage>
        ),
      },
      {
        path: 'graphs/:graphId',
        element: (
          <LazyPage>
            <GraphEditorPage />
          </LazyPage>
        ),
      },
      {
        path: 'control-room',
        element: (
          <LazyPage>
            <ControlRoomPage />
          </LazyPage>
        ),
      },
      {
        path: 'runtime',
        element: (
          <LazyPage>
            <RuntimePage />
          </LazyPage>
        ),
      },
    ],
  },
])
