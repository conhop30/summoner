import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { LazyMotion } from 'framer-motion'
import { router } from './router/index'
import MusicPlayer from './settings/MusicPlayer'
import ThemePlayer from './audio/ThemePlayer'
import AppHeader from './shared/AppHeader'
import UpdateBanner from './updater/UpdateBanner'
import './styles/tokens.css'
import './index.css'

// The animation engine is the biggest single library in the app, so it loads after the first paint
// instead of holding it up; the `m` components used on the editor pages start moving once it arrives.
const loadMotionFeatures = () => import('./shared/motionFeatures').then(mod => mod.default)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <AppHeader />
      <MusicPlayer />
      <ThemePlayer />
      <RouterProvider router={router} />
      <UpdateBanner />
    </LazyMotion>
  </React.StrictMode>
)