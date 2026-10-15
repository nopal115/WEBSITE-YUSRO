// Titik masuk mode mock. Hanya dimuat lewat import() dinamis saat VITE_USE_MOCK=true,
// sehingga tidak ikut ter-bundle di build produksi.
import { installMockControls } from './controls';
import { resolveIdentity, routes } from './handlers';
import { createMockFetch } from './router';

installMockControls();

export const mockFetch = createMockFetch(routes, resolveIdentity);
