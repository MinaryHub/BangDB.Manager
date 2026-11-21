import { describe, expect, it } from 'vitest';
import { compareVersions, downloadFor } from './update';

describe('compareVersions', () => {
  it('orders semver with or without v prefix', () => {
    expect(compareVersions('v0.4.0', '0.3.0')).toBe(1);
    expect(compareVersions('0.3.10', '0.3.9')).toBe(1);
    expect(compareVersions('0.3.0', '0.3.0')).toBe(0);
    expect(compareVersions('0.3', '0.3.1')).toBe(-1);
    expect(compareVersions('1.0.0', '0.9.9')).toBe(1);
  });
});

describe('downloadFor', () => {
  const rel = { tag_name: 'v0.4.0', html_url: 'https://example/rel', assets: [
    { name: 'bangdb-manager-v0.4.0-android-debug.apk', browser_download_url: 'https://example/apk' },
    { name: 'bangdb-manager-web-v0.4.0.zip', browser_download_url: 'https://example/zip' }
  ] };
  it('picks the apk on android and the page otherwise', () => {
    expect(downloadFor(rel, 'android')).toBe('https://example/apk');
    expect(downloadFor(rel, 'web')).toBe('https://example/zip');
    expect(downloadFor(rel, 'ios')).toBe('https://example/rel');
    expect(downloadFor({ tag_name: 'v1', html_url: 'https://example/rel' }, 'android')).toBe('https://example/rel');
  });
  it('picks the installer for the desktop OS', () => {
    const d = { tag_name: 'v1', html_url: 'https://example/rel', assets: [
      { name: 'bangdb-manager-1.0.0-windows-x64-setup.exe', browser_download_url: 'exe' },
      { name: 'bangdb-manager-1.0.0-macos-arm64.dmg', browser_download_url: 'dmg' },
      { name: 'bangdb-manager-1.0.0-linux-x86_64.AppImage', browser_download_url: 'appimage' }
    ] };
    expect(downloadFor(d, 'desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/35')).toBe('exe');
    expect(downloadFor(d, 'desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Electron/35')).toBe('dmg');
    expect(downloadFor(d, 'desktop', 'Mozilla/5.0 (X11; Linux x86_64) Electron/35')).toBe('appimage');
  });
});
