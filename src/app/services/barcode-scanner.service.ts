import { Injectable } from '@angular/core';

export interface BarcodeCaptureOptions {
  /** Máximo de ms entre caracteres para considerarlos parte del mismo escaneo. */
  charGapMs?: number;
  /** Si pasan más ms desde el último carácter, se reinicia el buffer. */
  resetGapMs?: number;
  /** Invocado cuando se detecta un código válido. */
  onScan: (codigo: string) => void;
  /** Si devuelve true, se ignoran las teclas (modales, etc.). */
  isPaused?: () => boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BarcodeScannerService {
  private listener: ((event: KeyboardEvent) => void) | null = null;
  private buffer = '';
  private lastKeyAt = 0;
  private options: BarcodeCaptureOptions | null = null;

  /** Normaliza el valor leído por el escáner (quita espacios, saltos y prefijos GS1). */
  normalizar(codigo: string): string {
    let s = (codigo || '').replace(/[\r\n\t]/g, '').trim();
    s = s.replace(/^\]C1/i, '').replace(/^\]E0/i, '');
    return s;
  }

  /** Solo dígitos, útil para EAN-13 u otros códigos numéricos. */
  soloDigitos(codigo: string): string {
    return this.normalizar(codigo).replace(/\D/g, '');
  }

  /** Compara dos códigos (exacto o solo dígitos si ambos son numéricos). */
  codigosEquivalentes(a: string, b: string): boolean {
    const na = this.normalizar(a).toLowerCase();
    const nb = this.normalizar(b).toLowerCase();
    if (!na || !nb) return false;
    if (na === nb) return true;
    const da = na.replace(/\D/g, '');
    const db = nb.replace(/\D/g, '');
    return da.length > 0 && da === db;
  }

  /** Los lectores USB suelen mandar Enter al final; esto detecta fin de lectura. */
  esCodigoValido(codigo: string): boolean {
    const n = this.normalizar(codigo);
    const digitos = n.replace(/\D/g, '');
    const principal = digitos.length >= 4 ? digitos : n;
    return principal.length >= 4 && principal.length <= 64;
  }

  /** Código listo para guardar/buscar (prefiere forma numérica limpia). */
  codigoParaBusqueda(codigo: string): string {
    const n = this.normalizar(codigo);
    const digitos = this.soloDigitos(n);
    if (digitos.length >= 4 && /^\d+$/.test(digitos)) return digitos;
    return n;
  }

  /**
   * Escucha escaneos a nivel documento (solo mientras la sesión esté activa).
   * Usa heurística de velocidad para distinguir lector USB de tipeo humano.
   */
  startCapture(options: BarcodeCaptureOptions): void {
    this.stopCapture();
    this.options = options;
    this.buffer = '';
    this.lastKeyAt = 0;
    this.listener = (event: KeyboardEvent) => this.handleKeyDown(event);
    document.addEventListener('keydown', this.listener, true);
  }

  stopCapture(): void {
    if (this.listener) {
      document.removeEventListener('keydown', this.listener, true);
      this.listener = null;
    }
    this.options = null;
    this.buffer = '';
    this.lastKeyAt = 0;
  }

  get captureActiva(): boolean {
    return this.listener != null;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.options) return;
    if (this.options.isPaused?.()) return;

    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.isComposing) return;

    const now = Date.now();
    const charGapMs = this.options.charGapMs ?? 50;
    const resetGapMs = this.options.resetGapMs ?? 200;
    let gap = this.lastKeyAt ? now - this.lastKeyAt : 0;

    if (event.key === 'Enter') {
      this.processEnter(event);
      return;
    }

    if (event.key.length !== 1) return;

    if (gap > resetGapMs) {
      this.buffer = '';
      this.lastKeyAt = 0;
      gap = 0;
    }

    const target = event.target as HTMLElement | null;
    const editable = this.isEditableTarget(target);

    // Tipeo humano en inputs: no interceptar salvo secuencia rápida ya iniciada (escáner).
    if (editable) {
      const secuenciaRapida = this.buffer.length > 0 && gap <= charGapMs;
      if (!secuenciaRapida) {
        this.buffer = '';
        this.lastKeyAt = now;
        return;
      }
      this.buffer += event.key;
      this.lastKeyAt = now;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const continuarSecuencia = this.buffer.length > 0 || gap <= charGapMs || this.lastKeyAt === 0;
    if (!continuarSecuencia) return;

    this.buffer += event.key;
    this.lastKeyAt = now;
  }

  private processEnter(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.isEditableTarget(target) && this.buffer.length === 0) return;

    const code = this.codigoParaBusqueda(this.buffer);
    this.buffer = '';
    this.lastKeyAt = 0;

    if (!this.esCodigoValido(code) || !this.options) return;

    event.preventDefault();
    event.stopPropagation();
    this.options.onScan(code);
  }

  private isEditableTarget(el: HTMLElement | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable;
  }
}
