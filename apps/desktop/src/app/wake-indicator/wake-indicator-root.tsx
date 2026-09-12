'use client'

import { createRoot } from 'react-dom/client'

import { WakeIndicatorApp } from './wake-indicator-app'

const root = createRoot(document.getElementById('wake-indicator-root')!)
root.render(<WakeIndicatorApp />)
