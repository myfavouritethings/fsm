import { FSMEditor } from './fsm/editor';
import { copyToClipboard, downloadTextFile } from './fsm/export/download';
import { CanvasViewport } from './canvas/viewport';
import { createExportDocument, parseImportJson, serializeExportDocument } from './io/json';
import { encodeShareLink, readShareFromLocation, clearShareHash } from './share/urlShare';
import {
  createMachine,
  deleteMachine,
  getMachine,
  loadStorage,
  migrateLegacyStorage,
  saveStorage,
  upsertMachine,
} from './storage/localStore';
import type { StoredFSM } from './fsm/types';

export class App {
  private editor: FSMEditor;
  private storage = migrateLegacyStorage(loadStorage());
  private activeMachine: StoredFSM | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private machineListEl: HTMLUListElement;
  private machineNameInput: HTMLInputElement;
  private outputTextarea: HTMLTextAreaElement;
  private shareInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private importInput: HTMLInputElement;
  private viewport: CanvasViewport;
  private statePropertiesPanel: HTMLElement;
  private stateTextInput: HTMLInputElement;
  private stateAttr2Preset: HTMLSelectElement;
  private stateAttr2Input: HTMLInputElement;
  private stateAcceptInput: HTMLInputElement;
  private stateStartInput: HTMLInputElement;

  constructor(root: HTMLElement) {
    root.innerHTML = this.renderShell();
    const canvas = root.querySelector<HTMLCanvasElement>('#canvas')!;
    this.machineListEl = root.querySelector('#machine-list')!;
    this.machineNameInput = root.querySelector('#machine-name')!;
    this.outputTextarea = root.querySelector('#output')!;
    this.shareInput = root.querySelector('#share-link')!;
    this.statusEl = root.querySelector('#status')!;
    this.importInput = root.querySelector('#import-json-input')!;
    this.statePropertiesPanel = root.querySelector('#state-properties')!;
    this.stateTextInput = root.querySelector('#state-text')!;
    this.stateAttr2Preset = root.querySelector('#state-attr2-preset')!;
    this.stateAttr2Input = root.querySelector('#state-attr2-custom')!;
    this.stateAcceptInput = root.querySelector('#state-accept')!;
    this.stateStartInput = root.querySelector('#state-start')!;

    this.editor = new FSMEditor(
      canvas,
      () => this.scheduleSave(),
      () => this.syncStatePropertiesPanel(),
    );
    this.viewport = new CanvasViewport(
      root.querySelector('#canvas-shell')!,
      canvas,
      root.querySelector('#canvas-width')!,
      root.querySelector('#canvas-height')!,
      root.querySelector('#canvas-size-label')!,
      root.querySelector('#canvas-fullscreen')!,
      root.querySelector('#canvas-apply')!,
      (size) => this.editor.setCanvasSize(size.width, size.height),
    );
    this.viewport.init();
    this.bindUi(root);
    this.bootstrap();
  }

  private renderShell(): string {
    return `
      <div class="app">
        <header class="header">
          <h1>Finite State Machine Designer</h1>
          <p class="subtitle">
            An enhanced fork of
            <a href="https://madebyevan.com/fsm/" target="_blank" rel="noopener noreferrer">Evan Wallace's Finite State Machine Designer</a>.
          </p>
        </header>

        <div class="layout">
          <aside class="sidebar">
            <div class="panel">
              <div class="panel-header">
                <h2>Machines</h2>
                <button type="button" id="new-machine" class="btn btn-primary">New</button>
              </div>
              <ul id="machine-list" class="machine-list"></ul>
            </div>
          </aside>

          <main class="main">
            <div class="toolbar">
              <label class="name-field">
                <span>Name</span>
                <input type="text" id="machine-name" placeholder="Untitled FSM" />
              </label>
              <div class="toolbar-actions">
                <button type="button" id="import-json" class="btn">Import JSON</button>
                <button type="button" id="export-json" class="btn">Export JSON</button>
                <button type="button" id="save-machine" class="btn">Save</button>
                <button type="button" id="delete-machine" class="btn btn-danger">Delete</button>
              </div>
              <input type="file" id="import-json-input" accept=".json,application/json" hidden />
            </div>

            <div class="canvas-panel">
              <div class="canvas-controls">
                <label class="canvas-size-field">
                  <span>Width</span>
                  <input type="number" id="canvas-width" min="400" max="4000" step="50" value="800" />
                </label>
                <label class="canvas-size-field">
                  <span>Height</span>
                  <input type="number" id="canvas-height" min="300" max="4000" step="50" value="600" />
                </label>
                <button type="button" id="canvas-apply" class="btn">Apply size</button>
                <button type="button" id="canvas-fullscreen" class="btn">Fullscreen</button>
                <span id="canvas-size-label" class="canvas-size-label">800 × 600</span>
              </div>

              <div class="canvas-shell" id="canvas-shell">
                <div class="canvas-shell-toolbar">
                  <span class="canvas-shell-title">FSM canvas</span>
                  <button type="button" id="canvas-fullscreen-exit" class="btn btn-primary canvas-exit-btn">Exit fullscreen</button>
                </div>
                <canvas id="canvas" width="800" height="600">
                  <span class="error">Your browser does not support the HTML5 canvas element.</span>
                </canvas>
                <div class="canvas-resize-handle" title="Drag to resize canvas"></div>
              </div>
            </div>

            <div id="state-properties" class="state-properties hidden">
              <h2>State properties</h2>
              <p class="state-properties-hint">Select a state to edit its label and attribute.</p>
              <div class="state-properties-grid">
                <label class="state-field">
                  <span>Label</span>
                  <input type="text" id="state-text" placeholder="State name" />
                </label>
                <label class="state-field">
                  <span>Attribute 2</span>
                  <select id="state-attr2-preset">
                    <option value="">(none)</option>
                    <option value="Even">Even</option>
                    <option value="Odd">Odd</option>
                    <option value="custom">Custom…</option>
                  </select>
                  <input type="text" id="state-attr2-custom" class="hidden" placeholder="Custom value" />
                </label>
                <label class="state-checkbox">
                  <input type="checkbox" id="state-accept" />
                  Accept state
                </label>
                <label class="state-checkbox">
                  <input type="checkbox" id="state-start" />
                  Start state (entry arrow from nowhere)
                </label>
              </div>
            </div>

            <div class="export-panel">
              <p class="export-links">
                Export as:
                <button type="button" id="export-png" class="link-btn">PNG</button>
                <button type="button" id="export-svg" class="link-btn">SVG</button>
                <button type="button" id="export-latex" class="link-btn">LaTeX</button>
                <button type="button" id="export-json-link" class="link-btn">JSON</button>
              </p>
              <textarea id="output" readonly placeholder="Exported SVG, LaTeX, or JSON will appear here…"></textarea>
            </div>

            <div class="share-panel">
              <h2>Share</h2>
              <p>Copy this link to share the current machine. The FSM data is embedded in the URL.</p>
              <div class="share-row">
                <input type="text" id="share-link" readonly />
                <button type="button" id="copy-share" class="btn">Copy link</button>
              </div>
            </div>

            <div class="help">
              <h2>How to use</h2>
              <ul>
                <li><strong>Add a state:</strong> double-click on the canvas</li>
                <li><strong>Add an arrow:</strong> shift-drag on the canvas</li>
                <li><strong>Move something:</strong> drag it around</li>
                <li><strong>Delete something:</strong> click it and press Delete (not Backspace)</li>
                <li><strong>Start state:</strong> marked with an entry arrow from a solid dot (●), or shift-drag from empty canvas</li>
                <li><strong>Accept state:</strong> double circle — double-click a state or use the checkbox</li>
                <li><strong>Mid-state attribute:</strong> set Attribute 2 to <strong>Even</strong>, <strong>Odd</strong>, or custom</li>
                <li><strong>Type numeric subscript:</strong> underscore before the number (like "S_0")</li>
                <li><strong>Type greek letter:</strong> backslash before it (like "\\beta")</li>
                <li><strong>Resize canvas:</strong> set width/height above, drag the corner handle, or use fullscreen</li>
              </ul>
            </div>

            <p id="status" class="status" aria-live="polite"></p>
          </main>
        </div>

        <footer class="credit">
          <p>
            Original <a href="https://madebyevan.com/fsm/" target="_blank" rel="noopener noreferrer">Finite State Machine Designer</a>
            by <a href="https://madebyevan.com/" target="_blank" rel="noopener noreferrer">Evan Wallace</a> (2010).
          </p>
        </footer>
      </div>
    `;
  }

  private bindUi(root: HTMLElement): void {
    root.querySelector('#new-machine')!.addEventListener('click', () => this.createNewMachine());
    root.querySelector('#save-machine')!.addEventListener('click', () => this.persistNow());
    root.querySelector('#delete-machine')!.addEventListener('click', () => this.deleteActiveMachine());
    root.querySelector('#export-png')!.addEventListener('click', () => void this.exportPng());
    root.querySelector('#export-svg')!.addEventListener('click', () => this.exportSvg());
    root.querySelector('#export-latex')!.addEventListener('click', () => this.exportLatex());
    root.querySelector('#export-json')!.addEventListener('click', () => this.exportJson());
    root.querySelector('#export-json-link')!.addEventListener('click', () => this.exportJson());
    root.querySelector('#import-json')!.addEventListener('click', () => this.importInput.click());
    root.querySelector('#copy-share')!.addEventListener('click', () => void this.copyShareLink());
    root.querySelector('#canvas-fullscreen-exit')!.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
    });

    this.importInput.addEventListener('change', () => void this.handleImportJson());

    this.machineNameInput.addEventListener('change', () => {
      if (!this.activeMachine) return;
      this.activeMachine.name = this.machineNameInput.value.trim() || 'Untitled FSM';
      this.persistNow();
      this.renderMachineList();
    });

    this.machineListEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-machine-id]');
      if (!target) return;
      void this.switchMachine(target.dataset.machineId!);
    });

    this.bindStateProperties();
  }

  private bindStateProperties(): void {
    const apply = () => this.applyStatePropertiesFromPanel();

    this.stateTextInput.addEventListener('input', apply);
    this.stateTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        apply();
        this.stateTextInput.blur();
      }
    });
    this.stateAttr2Input.addEventListener('input', apply);
    this.stateAcceptInput.addEventListener('change', apply);
    this.stateStartInput.addEventListener('change', apply);

    this.stateAttr2Preset.addEventListener('change', () => {
      const isCustom = this.stateAttr2Preset.value === 'custom';
      this.stateAttr2Input.classList.toggle('hidden', !isCustom);
      if (!isCustom) this.stateAttr2Input.value = '';
      apply();
    });
  }

  private syncStatePropertiesPanel(): void {
    const node = this.editor.getSelectedNode();
    if (!node) {
      this.statePropertiesPanel.classList.add('hidden');
      return;
    }

    this.statePropertiesPanel.classList.remove('hidden');
    if (document.activeElement !== this.stateTextInput) {
      this.stateTextInput.value = node.text;
    }

    if (node.attr2 === 'Even' || node.attr2 === 'Odd') {
      this.stateAttr2Preset.value = node.attr2;
      this.stateAttr2Input.classList.add('hidden');
      this.stateAttr2Input.value = '';
    } else if (node.attr2) {
      this.stateAttr2Preset.value = 'custom';
      this.stateAttr2Input.classList.remove('hidden');
      this.stateAttr2Input.value = node.attr2;
    } else {
      this.stateAttr2Preset.value = '';
      this.stateAttr2Input.classList.add('hidden');
      this.stateAttr2Input.value = '';
    }

    this.stateAcceptInput.checked = node.isAcceptState;
    this.stateStartInput.checked = node.isStartState;
  }

  private applyStatePropertiesFromPanel(): void {
    const node = this.editor.getSelectedNode();
    if (!node) return;

    let attr2 = '';
    if (this.stateAttr2Preset.value === 'Even' || this.stateAttr2Preset.value === 'Odd') {
      attr2 = this.stateAttr2Preset.value;
    } else if (this.stateAttr2Preset.value === 'custom') {
      attr2 = this.stateAttr2Input.value.trim();
    }

    this.editor.updateSelectedNode({
      text: this.stateTextInput.value,
      attr2,
      isAcceptState: this.stateAcceptInput.checked,
      isStartState: this.stateStartInput.checked,
    });
  }

  private bootstrap(): void {
    const shared = readShareFromLocation();
    if (shared) {
      const machine = createMachine(shared.name ?? 'Shared FSM', shared.data);
      this.storage = upsertMachine(this.storage, machine);
      saveStorage(this.storage);
      clearShareHash();
      this.activateMachine(machine);
      this.setStatus('Loaded shared FSM from link.');
      return;
    }

    if (this.storage.machines.length === 0) {
      const machine = createMachine('Untitled FSM');
      this.storage = upsertMachine(this.storage, machine);
      saveStorage(this.storage);
    }

    const active =
      (this.storage.activeId && getMachine(this.storage, this.storage.activeId)) ||
      this.storage.machines[0];
    this.activateMachine(active);
  }

  private activateMachine(machine: StoredFSM): void {
    this.activeMachine = machine;
    this.storage.activeId = machine.id;
    saveStorage(this.storage);
    this.machineNameInput.value = machine.name;
    this.editor.loadData(machine.data);
    this.updateShareLink();
    this.renderMachineList();
    this.outputTextarea.value = '';
    this.syncStatePropertiesPanel();
  }

  private async switchMachine(id: string): Promise<void> {
    if (this.activeMachine?.id === id) return;
    this.persistNow();
    const machine = getMachine(this.storage, id);
    if (machine) this.activateMachine(machine);
  }

  private createNewMachine(): void {
    this.persistNow();
    const machine = createMachine(`FSM ${this.storage.machines.length + 1}`);
    this.storage = upsertMachine(this.storage, machine);
    saveStorage(this.storage);
    this.activateMachine(machine);
    this.setStatus('Created new machine.');
  }

  private deleteActiveMachine(): void {
    if (!this.activeMachine) return;
    if (this.storage.machines.length <= 1) {
      this.setStatus('Cannot delete the last machine.');
      return;
    }
    if (!confirm(`Delete "${this.activeMachine.name}"?`)) return;

    const id = this.activeMachine.id;
    this.storage = deleteMachine(this.storage, id);
    saveStorage(this.storage);
    const next = getMachine(this.storage, this.storage.activeId!) ?? this.storage.machines[0];
    this.activateMachine(next);
    this.setStatus('Machine deleted.');
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persistNow(), 400);
  }

  private persistNow(): void {
    if (!this.activeMachine) return;
    this.activeMachine = {
      ...this.activeMachine,
      name: this.machineNameInput.value.trim() || 'Untitled FSM',
      updatedAt: Date.now(),
      data: this.editor.getData(),
    };
    this.storage = upsertMachine(this.storage, this.activeMachine);
    saveStorage(this.storage);
    this.updateShareLink();
    this.renderMachineList();
  }

  private renderMachineList(): void {
    this.machineListEl.innerHTML = this.storage.machines
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(
        (m) => `
          <li>
            <button
              type="button"
              class="machine-item ${m.id === this.activeMachine?.id ? 'active' : ''}"
              data-machine-id="${m.id}"
            >
              <span class="machine-item-name">${escapeHtml(m.name)}</span>
              <span class="machine-item-meta">${m.data.nodes.length} states</span>
            </button>
          </li>
        `,
      )
      .join('');
  }

  private updateShareLink(): void {
    if (!this.activeMachine) return;
    this.shareInput.value = encodeShareLink(this.activeMachine.name, this.editor.getData());
  }

  private async copyShareLink(): Promise<void> {
    this.updateShareLink();
    await copyToClipboard(this.shareInput.value);
    this.setStatus('Share link copied to clipboard.');
  }

  private async exportPng(): Promise<void> {
    try {
      const name = (this.activeMachine?.name ?? 'fsm').replace(/[^\w.-]+/g, '_');
      await this.editor.exportPng(`${name}.png`);
      this.setStatus('PNG downloaded.');
    } catch (err) {
      this.setStatus(err instanceof Error ? err.message : 'PNG export failed.');
    }
  }

  private exportSvg(): void {
    const svg = this.editor.exportSvg();
    this.outputTextarea.value = svg;
    this.outputTextarea.style.display = 'block';
    const name = (this.activeMachine?.name ?? 'fsm').replace(/[^\w.-]+/g, '_');
    this.editor.exportSvgFile(`${name}.svg`);
    this.setStatus('SVG downloaded and shown below.');
  }

  private exportLatex(): void {
    const latex = this.editor.exportLatex();
    this.outputTextarea.value = latex;
    this.outputTextarea.style.display = 'block';
    this.setStatus('LaTeX copied to output area.');
  }

  private exportJson(): void {
    this.persistNow();
    const name = this.machineNameInput.value.trim() || 'Untitled FSM';
    const doc = createExportDocument(name, this.editor.getData());
    const json = serializeExportDocument(doc);
    const filename = `${name.replace(/[^\w.-]+/g, '_')}.json`;
    downloadTextFile(json, filename, 'application/json;charset=utf-8');
    this.outputTextarea.value = json;
    this.outputTextarea.style.display = 'block';
    this.setStatus('JSON downloaded.');
  }

  private async handleImportJson(): Promise<void> {
    const file = this.importInput.files?.[0];
    this.importInput.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parseImportJson(text);
      this.persistNow();
      const machine = createMachine(imported.name, imported.data);
      this.storage = upsertMachine(this.storage, machine);
      saveStorage(this.storage);
      this.activateMachine(machine);
      this.setStatus(`Imported "${imported.name}" as a new machine.`);
    } catch (err) {
      this.setStatus(err instanceof Error ? err.message : 'Import failed.');
    }
  }

  private setStatus(message: string): void {
    this.statusEl.textContent = message;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
