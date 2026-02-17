import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Kakao SDK 초기화
if (window.Kakao && !window.Kakao.isInitialized()) {
  window.Kakao.init('189df550a388149ee0ade152a3037266');
  console.log('Kakao SDK 초기화 완료:', window.Kakao.isInitialized());
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)