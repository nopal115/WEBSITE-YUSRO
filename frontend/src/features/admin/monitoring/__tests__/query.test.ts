import { describe, expect, it } from 'vitest';
import { hasMonitoringFilters, parseMonitoringQuery, toMonitoringParams, toSubmissionApiParams, validateDateRange } from '../query';

describe('parseMonitoringQuery', () => {
  it('bawaan saat URL kosong', () => {
    expect(parseMonitoringQuery(new URLSearchParams())).toEqual({ status: '', taskId: '', studentId: '', from: '', to: '', page: 1 });
  });

  it('membaca semua parameter dan mengabaikan nilai tidak valid', () => {
    expect(parseMonitoringQuery(new URLSearchParams('status=FAILED&taskId=t1&studentId=s1&from=2026-09-01&to=2026-09-30&page=2'))).toEqual({
      status: 'FAILED',
      taskId: 't1',
      studentId: 's1',
      from: '2026-09-01',
      to: '2026-09-30',
      page: 2,
    });
    expect(parseMonitoringQuery(new URLSearchParams('status=GAGAL&from=1-9-2026&page=abc'))).toMatchObject({ status: '', from: '', page: 1 });
  });

  it('rentang terbalik dari URL membuang tanggal akhir', () => {
    expect(parseMonitoringQuery(new URLSearchParams('from=2026-09-10&to=2026-09-01'))).toMatchObject({ from: '2026-09-10', to: '' });
  });
});

describe('toMonitoringParams / toSubmissionApiParams', () => {
  it('bolak-balik URL sama; request selalu membawa page', () => {
    const url = 'status=PROCESSING&taskId=t2&studentId=usr-contoh-11&from=2026-09-01&to=2026-09-02&page=3';
    expect(toMonitoringParams(parseMonitoringQuery(new URLSearchParams(url))).toString()).toBe(url);
    expect(toSubmissionApiParams(parseMonitoringQuery(new URLSearchParams('status=FAILED'))).toString()).toBe('status=FAILED&page=1');
  });
});

describe('hasMonitoringFilters / validateDateRange', () => {
  it('halaman bukan filter; chip santri termasuk filter', () => {
    expect(hasMonitoringFilters(parseMonitoringQuery(new URLSearchParams('page=2')))).toBe(false);
    expect(hasMonitoringFilters(parseMonitoringQuery(new URLSearchParams('studentId=s1')))).toBe(true);
  });

  it('tanggal akhir tidak boleh lebih awal', () => {
    expect(validateDateRange('', '')).toBeNull();
    expect(validateDateRange('2026-09-01', '2026-09-01')).toBeNull();
    expect(validateDateRange('2026-09-10', '2026-09-01')).toBe('Tanggal akhir tidak boleh lebih awal dari tanggal awal.');
  });
});
