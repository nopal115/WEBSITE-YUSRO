import type { MockRoute } from '../router';
import { adminRoutes } from './admin';
import { contentRoutes } from './content';
import { monitoringRoutes } from './monitoring';
import { authRoutes } from './auth';
import { imitationRoutes } from './imitation';
import { learningRoutes } from './learning';
import { profileRoutes } from './profile';
import { progressRoutes } from './progress';
import { quizRoutes } from './quiz';

export { resolveIdentity } from './auth';

// Endpoint sisi Santri SDD 5.6–5.13 dan endpoint Admin yang sudah ditiru (handlers/admin.ts, monitoring.ts, content.ts).
export const routes: MockRoute[] = [...authRoutes, ...profileRoutes, ...learningRoutes, ...quizRoutes, ...imitationRoutes, ...progressRoutes, ...adminRoutes, ...monitoringRoutes, ...contentRoutes];
