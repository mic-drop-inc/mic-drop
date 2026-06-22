// Electrobun main process (Bun). Owns the OS window and does all filesystem I/O
// natively — the macOS/Linux system webview has no File System Access API, so
// file picking + read/write live here and cross to the webview over typed RPC.
//
// The webview content is the SAME Vite build the browser uses (copied into
// views/mainview by electrobun.config.ts). The app routes file ops through this
// RPC when it detects the Electrobun bridge (see src/lib/fileStore.index.ts).
import { BrowserWindow, BrowserView, Utils, ApplicationMenu } from 'electrobun/bun';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FileRPC } from './rpc';

// Standard macOS menu. Without it there are no Cmd+Q / Cmd+W, and the webview
// gets no Cmd+C/V/X/A (those are driven by the Edit menu roles).
ApplicationMenu.setApplicationMenu([
  {
    label: 'Mic Drop',
    submenu: [
      { label: 'About Mic Drop', role: 'about' },
      { type: 'separator' },
      { label: 'Hide Mic Drop', role: 'hide' },
      { label: 'Hide Others', role: 'hideOthers' },
      { type: 'separator' },
      { label: 'Quit Mic Drop', role: 'quit', accelerator: 'CommandOrControl+Q' },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { label: 'Undo', role: 'undo' },
      { label: 'Redo', role: 'redo' },
      { type: 'separator' },
      { label: 'Cut', role: 'cut' },
      { label: 'Copy', role: 'copy' },
      { label: 'Paste', role: 'paste' },
      { label: 'Select All', role: 'selectAll' },
    ],
  },
  {
    label: 'Window',
    submenu: [
      { label: 'Minimize', role: 'minimize', accelerator: 'CommandOrControl+M' },
      { label: 'Zoom', role: 'zoom' },
      { label: 'Close Window', role: 'close', accelerator: 'CommandOrControl+W' },
    ],
  },
]);

// Never clobber an existing file: nsda-ballots.sqlite -> nsda-ballots-1.sqlite …
function uniquePath(folder: string, name: string): string {
  if (!existsSync(join(folder, name))) return join(folder, name);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  while (existsSync(join(folder, `${stem}-${i}${ext}`))) i++;
  return join(folder, `${stem}-${i}${ext}`);
}

const rpc = BrowserView.defineRPC<FileRPC>({
  maxRequestTime: 30000,
  handlers: {
    requests: {
      ping: ({ msg }) => `pong: ${msg}`,

      openExisting: async ({ startingFolder }) => {
        const paths = await Utils.openFileDialog({
          ...(startingFolder ? { startingFolder } : {}),
          allowedFileTypes: 'sqlite,db',
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: false,
        });
        const path = paths.filter(Boolean)[0];
        if (!path) return null;
        return { path };
      },

      createNew: async ({ name, startingFolder }) => {
        const folders = await Utils.openFileDialog({
          ...(startingFolder ? { startingFolder } : {}),
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        const folder = folders.filter(Boolean)[0];
        if (!folder) return null;
        let fileName = (name || 'nsda-ballots.sqlite').trim();
        if (!/\.(sqlite|db)$/i.test(fileName)) fileName += '.sqlite';
        const path = uniquePath(folder, fileName);
        writeFileSync(path, Buffer.alloc(0)); // create empty; app writes the schema
        return { path };
      },

      readFile: ({ path }) => Buffer.from(readFileSync(path)).toString('base64'),

      writeFile: ({ path, bytesB64 }) => {
        writeFileSync(path, Buffer.from(bytesB64, 'base64'));
        return true;
      },
    },
    messages: {},
  },
});

new BrowserWindow<typeof rpc>({
  title: 'Mic Drop',
  url: 'views://mainview/index.html',
  frame: { x: 0, y: 0, width: 1200, height: 840 },
  rpc,
});
