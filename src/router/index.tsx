import { createHashRouter } from 'react-router-dom'
import GalleryPage from '../gallery/GalleryPage'
import ViewPage from '../editor/ViewPage'
import EditPage from '../editor/EditPage'
import CreatePage from '../editor/CreatePage'
import ItemsPage from '../items/ItemsPage'
import SettingsPage from '../settings/SettingsPage'

export const router = createHashRouter([
  { path: '/',           element: <GalleryPage /> },
  { path: '/view/:id',   element: <ViewPage /> },
  { path: '/edit/:id',   element: <EditPage /> },
  { path: '/create',     element: <CreatePage /> },
  { path: '/items',      element: <ItemsPage /> },
  { path: '/settings',   element: <SettingsPage /> },
])