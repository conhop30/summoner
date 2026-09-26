import { createHashRouter } from 'react-router-dom'
import GalleryPage from '../gallery/GalleryPage'

// The gallery is where a normal launch lands, so it is in the first bundle. Every other page loads
// the first time it is opened, which keeps the editor and its win-rate model out of the way of
// startup.
export const router = createHashRouter([
  { path: '/',           element: <GalleryPage /> },
  { path: '/view/:id',   lazy: async () => ({ Component: (await import('../editor/ViewPage')).default }) },
  { path: '/edit/:id',   lazy: async () => ({ Component: (await import('../editor/EditPage')).default }) },
  { path: '/create',     lazy: async () => ({ Component: (await import('../editor/CreatePage')).default }) },
  { path: '/items',      lazy: async () => ({ Component: (await import('../items/ItemsPage')).default }) },
  { path: '/settings',   lazy: async () => ({ Component: (await import('../settings/SettingsPage')).default }) },
])
