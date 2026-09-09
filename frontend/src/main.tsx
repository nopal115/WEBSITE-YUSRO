import React from 'react';
import { createRoot } from 'react-dom/client';

function App(): JSX.Element { return <main>Yusro</main>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
