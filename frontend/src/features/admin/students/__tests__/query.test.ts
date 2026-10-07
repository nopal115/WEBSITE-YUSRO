import { describe, expect, it } from 'vitest';
import { DEFAULT_SORT, hasActiveFilters, parsePercent, parseStudentQuery, toApiParams, toSearchParams, validateRange } from '../query';

describe('parseStudentQuery', () => {
  it('bawaan saat URL kosong', () => {
    expect(parseStudentQuery(new URLSearchParams())).toEqual({ q: '', stageId: '', progressMin: null, progressMax: null, scoreMin: null, scoreMax: null, status: '', sort: DEFAULT_SORT, page: 1 });
  });

  it('membaca semua parameter dan mengabaikan nilai tidak valid', () => {
    const query = parseStudentQuery(new URLSearchParams('q=%20budi%20&stageId=stg-1&progressMin=10&progressMax=abc&scoreMin=101&scoreMax=87.5&status=INACTIVE&sort=progress:desc&page=3'));
    expect(query).toEqual({ q: 'budi', stageId: 'stg-1', progressMin: 10, progressMax: null, scoreMin: null, scoreMax: 87.5, status: 'INACTIVE', sort: 'progress:desc', page: 3 });
    expect(parseStudentQuery(new URLSearchParams('status=AKTIF&sort=umur:asc&page=-2'))).toMatchObject({ status: '', sort: DEFAULT_SORT, page: 1 });
  });
});

describe('toSearchParams / toApiParams', () => {
  it('nilai bawaan tidak ditulis ke URL; request selalu membawa sort dan page', () => {
    const query = parseStudentQuery(new URLSearchParams('q=ani&progressMin=0&scoreMax=90'));
    expect(toSearchParams(query).toString()).toBe('q=ani&progressMin=0&scoreMax=90');
    expect(toApiParams(query).toString()).toBe('q=ani&progressMin=0&scoreMax=90&sort=name%3Aasc&page=1');
  });

  it('bolak-balik URL tetap sama', () => {
    const url = 'q=ysr-000104&stageId=stg-2&progressMin=20&progressMax=60&scoreMin=70&scoreMax=90&status=ACTIVE&sort=lastActivity%3Adesc&page=2';
    expect(toSearchParams(parseStudentQuery(new URLSearchParams(url))).toString()).toBe(url);
  });
});

describe('hasActiveFilters', () => {
  it('urutan dan halaman bukan filter', () => {
    expect(hasActiveFilters(parseStudentQuery(new URLSearchParams('sort=progress:desc&page=2')))).toBe(false);
    expect(hasActiveFilters(parseStudentQuery(new URLSearchParams('scoreMin=0')))).toBe(true);
    expect(hasActiveFilters(parseStudentQuery(new URLSearchParams('status=ACTIVE')))).toBe(true);
  });
});

describe('validateRange', () => {
  it('angka 0–100 dan min ≤ maks', () => {
    expect(validateRange('', '')).toEqual({});
    expect(validateRange('20', '80')).toEqual({});
    expect(validateRange('50', '50')).toEqual({});
    expect(validateRange('80', '20')).toEqual({ max: 'Maksimum tidak boleh lebih kecil dari minimum.' });
    expect(validateRange('-1', '200')).toEqual({ min: 'Isi angka 0–100.', max: 'Isi angka 0–100.' });
    expect(validateRange('abc', '')).toEqual({ min: 'Isi angka 0–100.' });
    expect(parsePercent('87,5')).toBe(87.5);
  });
});
