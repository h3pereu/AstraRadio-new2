'use strict';

const fs = require('fs');
const path = require('path');

const modulePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-track-player',
  'android',
  'src',
  'main',
  'java',
  'com',
  'doublesymmetry',
  'trackplayer',
  'module',
  'MusicModule.kt',
);

const servicePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-track-player',
  'android',
  'src',
  'main',
  'java',
  'com',
  'doublesymmetry',
  'trackplayer',
  'service',
  'MusicService.kt',
);

function patchMusicModule() {
  if (!fs.existsSync(modulePath)) {
    console.warn('[patch-track-player] File not found, skipping:', modulePath);
    return { changed: false, messages: ['module missing'] };
  }

  const content = fs.readFileSync(modulePath, 'utf8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';

const before1 =
  '            callback.resolve(Arguments.fromBundle(musicService.tracks[index].originalItem))';
const after1 = [
  '            val originalItem = musicService.tracks[index].originalItem',
  '            callback.resolve(originalItem?.let { Arguments.fromBundle(it) })',
].join(eol);

const before2 = [
  '            if (musicService.tracks.isEmpty()) null',
  '            else Arguments.fromBundle(',
  '                musicService.tracks[musicService.getCurrentTrackIndex()].originalItem',
  '            )',
].join(eol);

const after2 = [
  '            if (musicService.tracks.isEmpty()) null',
  '            else {',
  '                val originalItem = musicService.tracks[musicService.getCurrentTrackIndex()].originalItem',
  '                originalItem?.let { Arguments.fromBundle(it) }',
  '            }',
].join(eol);

  let updated = content;
  let changed = false;
  const messages = [];

const alreadyPatched = updated.includes(after1) && updated.includes(after2);

if (!alreadyPatched) {
  if (!updated.includes(before1) || !updated.includes(before2)) {
    console.error('[patch-track-player] Expected patterns not found.');
    process.exit(1);
  }

  updated = updated.replace(before1, after1).replace(before2, after2);
  changed = true;
  messages.push('nullability patch applied');
} else {
  messages.push('nullability already patched');
}

function patchReactMethodReturns(input) {
  const lines = input.split(eol);
  let changedLocal = false;

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('@ReactMethod')) {
      continue;
    }

    let j = i + 1;
    while (j < lines.length && !lines[j].includes('fun ')) {
      j += 1;
    }
    if (j >= lines.length) {
      continue;
    }

    const funLine = lines[j];
    let launchLineIndex = -1;

    if (funLine.includes('=') && funLine.includes('scope.launch')) {
      launchLineIndex = j;
    } else if (funLine.trim().endsWith('=')) {
      let k = j + 1;
      while (k < lines.length && lines[k].trim() === '') {
        k += 1;
      }
      if (k < lines.length && lines[k].includes('scope.launch')) {
        launchLineIndex = k;
      }
    }

    if (launchLineIndex === -1) {
      continue;
    }

    if (!/:\s*Unit\b/.test(funLine)) {
      lines[j] = funLine.replace(/\)\s*=/, '): Unit =');
      changedLocal = true;
    }

    let depth = 0;
    let started = false;
    for (let m = launchLineIndex; m < lines.length; m += 1) {
      const line = lines[m];
      for (let c = 0; c < line.length; c += 1) {
        const ch = line[c];
        if (ch === '{') {
          depth += 1;
          started = true;
        } else if (ch === '}') {
          depth -= 1;
          if (started && depth === 0) {
            if (!line.includes('.let { }')) {
              if (/}\s*$/.test(line)) {
                lines[m] = line.replace(/}\s*$/, '}.let { }');
              } else {
                lines[m] = `${line}.let { }`;
              }
              changedLocal = true;
            }
            m = lines.length;
            break;
          }
        }
      }
    }
  }

  return { content: lines.join(eol), changed: changedLocal };
}

  const reactMethodPatch = patchReactMethodReturns(updated);
  updated = reactMethodPatch.content;
  if (reactMethodPatch.changed) {
    changed = true;
    messages.push('react method patch applied');
  } else {
    messages.push('react method already patched');
  }

  if (changed) {
    fs.writeFileSync(modulePath, updated);
  }

  return { changed, messages };
}

function patchMusicService() {
  if (!fs.existsSync(servicePath)) {
    console.warn('[patch-track-player] File not found, skipping:', servicePath);
    return { changed: false, messages: ['service missing'] };
  }

  const content = fs.readFileSync(servicePath, 'utf8');
  const before = 'reactNativeHost.reactInstanceManager.currentReactContext';
  const after = 'reactContext';

  if (!content.includes(before)) {
    if (content.includes(after)) {
      return { changed: false, messages: ['service already patched'] };
    }
    console.error('[patch-track-player] Expected service pattern not found.');
    process.exit(1);
  }

  const updated = content.split(before).join(after);
  if (updated !== content) {
    fs.writeFileSync(servicePath, updated);
    return { changed: true, messages: ['service patch applied'] };
  }

  return { changed: false, messages: ['service already patched'] };
}

const moduleResult = patchMusicModule();
const serviceResult = patchMusicService();
const allMessages = [...moduleResult.messages, ...serviceResult.messages];
const changed = moduleResult.changed || serviceResult.changed;

console.log(`[patch-track-player] ${allMessages.join('; ')}.`);
