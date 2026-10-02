import { describe, expect, it } from 'vitest';
import { homePathForRole, resolvePostLoginPath } from '../redirect';

describe('resolvePostLoginPath', () => {
  it('kembali ke halaman yang tadi diminta', () => {
    expect(resolvePostLoginPath('/progress?tab=1', 'SANTRI')).toBe('/progress?tab=1');
    expect(resolvePostLoginPath('/admin', 'ADMIN')).toBe('/admin');
  });

  it('ke beranda role bila tidak ada tujuan', () => {
    expect(resolvePostLoginPath(undefined, 'SANTRI')).toBe('/dashboard');
    expect(resolvePostLoginPath(undefined, 'ADMIN')).toBe('/admin');
  });

  it('menolak tujuan eksternal (open redirect)', () => {
    for (const from of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)']) {
      expect(resolvePostLoginPath(from, 'SANTRI')).toBe(homePathForRole('SANTRI'));
    }
  });

  it('menolak tujuan yang tidak sesuai role', () => {
    expect(resolvePostLoginPath('/admin', 'SANTRI')).toBe('/dashboard');
    expect(resolvePostLoginPath('/dashboard', 'ADMIN')).toBe('/admin');
  });

  it('tidak kembali ke halaman auth', () => {
    expect(resolvePostLoginPath('/login', 'SANTRI')).toBe('/dashboard');
  });
});
