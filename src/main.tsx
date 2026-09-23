import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router/index'
import MusicPlayer from './settings/MusicPlayer'
import CustomTitleBar from './shared/CustomTitleBar'
import UpdateBanner from './updater/UpdateBanner'
import './styles/tokens.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CustomTitleBar />
    <MusicPlayer />
    <RouterProvider router={router} />
    <UpdateBanner />
  </React.StrictMode>
)