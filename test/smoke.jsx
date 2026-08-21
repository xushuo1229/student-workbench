import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App.jsx'
import { StoreProvider } from '../src/store/StoreContext.jsx'

const root = createRoot(document.getElementById('root'))
root.render(React.createElement(StoreProvider, null, React.createElement(App)))
window.__APP_READY = true
