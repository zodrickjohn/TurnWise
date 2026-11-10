import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import 'lenis/dist/lenis.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
// Works offline after the first visit (built site only: the dev server changes files all the time)
if (import.meta.env.PROD && 'serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js'))
