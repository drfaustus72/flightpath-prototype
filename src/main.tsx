import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { routes } from './app/routes'
import { SeedErrorScreen } from './app/SeedErrorScreen'
import { seedResult } from './data/seed'
import { StoreProvider } from './store/StoreProvider'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('index.html is missing #root')

const router = createBrowserRouter(routes)

createRoot(rootElement).render(
  <StrictMode>
    {seedResult.ok ? (
      <StoreProvider world={seedResult.world}>
        <RouterProvider router={router} />
      </StoreProvider>
    ) : (
      <SeedErrorScreen errors={seedResult.errors} />
    )}
  </StrictMode>,
)
