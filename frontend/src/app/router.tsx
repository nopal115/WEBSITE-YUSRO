import { BrowserRouter, Route, Routes } from 'react-router-dom'

function PlaceholderPage() {
  return <main>Metode Yusro</main>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<PlaceholderPage />} />
      </Routes>
    </BrowserRouter>
  )
}
