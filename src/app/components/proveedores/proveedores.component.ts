import { Component, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService, Proveedor, ItemListaProveedor, PedidoItemProveedor } from '../../services/database.service';
import { ToastService } from '../../services/toast.service';
import { IconComponent } from '../icon/icon.component';


@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.scss']
})
export class ProveedoresComponent {
  proveedores: Proveedor[] = [];
  mostrarForm = false;
  nuevo = { nombre: '', ubicacion: '', descripcion: '' };
  filtro = '';

  proveedorSeleccionadoId: number | null = null;
  itemsProveedor: ItemListaProveedor[] = [];
  descuentoCargaPorProveedor: Record<number, number> = {};
  modalCargaProveedorId: number | null = null;
  modalDescuentoPct: number = 0;
  modalArchivo: File | null = null;

  pedido: Array<ItemListaProveedor & { cantidad: number }> = [];
  pedidosHistorial: { id: number; fecha: Date; total: number; entregado: boolean; pagado: boolean }[] = [];
  proveedorAReemplazarId: number | null = null;

  // Edición inline
  editandoId: number | null = null;
  edit = { nombre: '', ubicacion: '', descripcion: '' };

  constructor(private db: DatabaseService, private toast: ToastService) {
    this.db.getProveedores().subscribe(list => {
      this.proveedores = list;
      if (this.proveedorSeleccionadoId) {
        this.refrescarItems();
      }
    });

    try {
      const raw = localStorage.getItem('mc_descuentos_proveedores');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.descuentoCargaPorProveedor = parsed;
        }
      }
    } catch {}
  }

  toggleForm(): void {
    this.mostrarForm = !this.mostrarForm;
  }

  agregarProveedor(): void {
    const nombreOk = (this.nuevo.nombre || '').trim().length > 0;
    const ubicacionOk = (this.nuevo.ubicacion || '').trim().length > 0;
    const descripcionOk = (this.nuevo.descripcion || '').trim().length > 0;
    if (!nombreOk || !ubicacionOk || !descripcionOk) {
      this.toast.show('Completá Nombre, Ubicación y Descripción.', 'error');
      return;
    }
    const p = this.db.agregarProveedor({ ...this.nuevo });
    if (p) {
      this.toast.show('Proveedor agregado.');
      this.nuevo = { nombre: '', ubicacion: '', descripcion: '' };
      this.mostrarForm = false;
    }
  }

  async eliminarProveedor(id: number): Promise<void> {
    const ok = await this.toast.confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.', 'warning');
    if (!ok) { return; }
    this.db.eliminarProveedor(id);
    if (this.proveedorSeleccionadoId === id) {
      this.proveedorSeleccionadoId = null;
      this.itemsProveedor = [];
      this.pedido = [];
    }
    this.toast.show('Proveedor eliminado.', 'warning');
  }

  iniciarEdicion(p: Proveedor): void {
    this.editandoId = p.id;
    this.edit = { nombre: p.nombre, ubicacion: p.ubicacion, descripcion: p.descripcion };
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.edit = { nombre: '', ubicacion: '', descripcion: '' };
  }

  guardarEdicion(id: number): void {
    const n = (this.edit.nombre || '').trim();
    const u = (this.edit.ubicacion || '').trim();
    const d = (this.edit.descripcion || '').trim();
    if (!n || !u || !d) {
      this.toast.show('Completá Nombre, Ubicación y Descripción.', 'error');
      return;
    }
    const ok = this.db.actualizarProveedor({ id, nombre: n, ubicacion: u, descripcion: d });
    if (ok) {
      this.toast.show('Proveedor actualizado.', 'success');
      this.cancelarEdicion();
    } else {
      this.toast.show('No se pudo actualizar.', 'error');
    }
  }

  seleccionarProveedor(id: number): void {
    this.proveedorSeleccionadoId = id;
    this.pedido = [];
    this.refrescarItems();
    this.cargarHistorial();
  }

  cerrarPanel(): void {
    this.proveedorSeleccionadoId = null;
    this.itemsProveedor = [];
    this.pedido = [];
  }

  refrescarItems(): void {
    if (!this.proveedorSeleccionadoId) { this.itemsProveedor = []; return; }
    this.itemsProveedor = this.db.getItemsProveedor(this.proveedorSeleccionadoId);
  }

  cargarHistorial(): void {
    if (!this.proveedorSeleccionadoId) { this.pedidosHistorial = []; return; }
    const list = this.db.getPedidosProveedor(this.proveedorSeleccionadoId);
    this.pedidosHistorial = list.map(p => ({ id: p.id, fecha: p.fecha, total: p.total, entregado: p.entregado, pagado: p.pagado }));
  }

  onArchivoExcel(event: Event, proveedorId: number): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { read, utils } = await import('xlsx');
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });

        const items: ItemListaProveedor[] = [];
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          if (!ws) continue;
          const json = utils.sheet_to_json(ws, { defval: '' });
          for (const row of json as any[]) {
            const it = this.mapearFilaExcel(row);
            if (it) items.push(it);
          }
        }

        if (!items.length) {
          this.toast.show('No se detectaron productos en el Excel.', 'error');
          (event.target as HTMLInputElement).value = '';
          return;
        }

        const conPrecio = items.filter(it => Number(it.precio) > 0).length;
        if (!conPrecio) {
          this.toast.show('No se detectaron precios. Revisá columnas: Precio, PVP, Valor, Precio Unitario.', 'error');
        }

        const pct = Number(this.descuentoCargaPorProveedor[proveedorId] || 0);
        const itemsAjustados = pct ? items.map(it => ({
          ...it,
          precio: Number((Number(it.precio) * (1 - pct / 100)).toFixed(2))
        })) : items;

        this.db.agregarListaPrecios(proveedorId, file.name, itemsAjustados);
        if (this.proveedorSeleccionadoId === proveedorId) {
          this.refrescarItems();
        }
        this.toast.show(`Lista cargada: ${items.length} ítems${conPrecio ? ` (${conPrecio} con precio)` : ''}${pct ? ` · ajuste ${pct}%` : ''}.`, 'success');
        (event.target as HTMLInputElement).value = '';
      } catch {
        this.toast.show('Error leyendo el archivo. ¿Es un Excel válido?', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  abrirModalCarga(proveedorId: number): void {
    this.modalCargaProveedorId = proveedorId;
    this.modalDescuentoPct = Number(this.descuentoCargaPorProveedor[proveedorId] || 0);
    this.modalArchivo = null;
  }

  cancelarModalCarga(): void {
    this.modalCargaProveedorId = null;
    this.modalArchivo = null;
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.modalArchivo = files && files.length ? files[0] : null;
  }

  async confirmarCargaExcel(): Promise<void> {
    if (!this.modalCargaProveedorId || !this.modalArchivo) return;
    const proveedorId = this.modalCargaProveedorId;
    const file = this.modalArchivo;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { read, utils } = await import('xlsx');
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });
        const items: ItemListaProveedor[] = [];
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          if (!ws) continue;
          const json = utils.sheet_to_json(ws, { defval: '' });
          for (const row of json as any[]) {
            const it = this.mapearFilaExcel(row);
            if (it) items.push(it);
          }
        }
        if (!items.length) {
          this.toast.show('No se detectaron productos en el Excel.', 'error');
          return;
        }
        const conPrecio = items.filter(it => Number(it.precio) > 0).length;
        if (!conPrecio) {
          this.toast.show('No se detectaron precios. Revisá columnas: Precio, PVP, Valor, Precio Unitario.', 'error');
        }
        const pct = Number(this.modalDescuentoPct || 0);
        this.descuentoCargaPorProveedor[proveedorId] = pct;
        try {
          localStorage.setItem('mc_descuentos_proveedores', JSON.stringify(this.descuentoCargaPorProveedor));
        } catch {}
        const itemsAjustados = pct ? items.map(it => ({
          ...it,
          precio: Number((Number(it.precio) * (1 - pct / 100)).toFixed(2))
        })) : items;
        this.db.agregarListaPrecios(proveedorId, file.name, itemsAjustados);
        if (this.proveedorSeleccionadoId === proveedorId) {
          this.refrescarItems();
        }
        this.toast.show(`Lista cargada: ${items.length} ítems${conPrecio ? ` (${conPrecio} con precio)` : ''}${pct ? ` · ajuste ${pct}%` : ''}.`, 'success');
      } catch {
        this.toast.show('Error leyendo el archivo. ¿Es un Excel válido?', 'error');
      } finally {
        this.cancelarModalCarga();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private mapearFilaExcel(row: any): ItemListaProveedor | null {
    const normalize = (s: string) => s
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9/]/g, '');

    const normalized: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[normalize(k)] = v;
    }

    const pick = (keys: string[], includes: string[] = []) => {
      for (const k of keys) if (normalized[k] !== undefined && normalized[k] !== null && normalized[k] !== '') return normalized[k];
      if (includes.length) {
        const entry = Object.entries(normalized).find(([kk, vv]) => includes.some(i => kk.includes(i)) && vv !== undefined && vv !== null && vv !== '');
        if (entry) return entry[1];
      }
      return undefined;
    };

    const codigoRaw = pick(['codigo','codigointerno','cod','codigo/ref','codigoref','ref'], ['codigo','cod']);
    const nombreRaw = pick(['descripcion','detalle','producto','articulo','nombre','detalleproducto'], ['desc','detalle','producto','art']);
    let precioRaw: any = pick(['precio','preciolista','preciounitario','preciofinal','precioconiva','pvp','valor','lista'], ['precio','pvp','valor','lista']);

    if (precioRaw === undefined || precioRaw === null || precioRaw === '') {
      for (const [k, v] of Object.entries(normalized)) {
        if (k.includes('cod') || k.includes('desc') || k.includes('nombre') || k.includes('producto') || k.includes('art')) continue;
        const parsed = Number(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        if (!isNaN(parsed) && isFinite(parsed)) { precioRaw = v; break; }
      }
    }

    const precio = this.parsePrecio(precioRaw);
    const c = String(codigoRaw || '').trim();
    const n = String(nombreRaw || '').trim();
    if (!c && !n) return null;
    return { codigo: c || n, nombre: n || c, precio: isNaN(precio) ? 0 : precio };
  }

  private parsePrecio(input: any): number {
    if (typeof input === 'number') return Number(input);
    const raw = String(input ?? '').trim();
    if (!raw) return NaN;
    const onlyNums = raw.replace(/[^0-9.,-]/g, '');
    const hasComma = onlyNums.includes(',');
    const hasDot = onlyNums.includes('.');
    if (hasComma && hasDot) {
      return Number(onlyNums.replace(/\./g, '').replace(',', '.'));
    }
    if (hasDot && !hasComma) {
      const lastDot = onlyNums.lastIndexOf('.');
      const digitsAfter = onlyNums.length - lastDot - 1;
      if (digitsAfter === 3) {
        return Number(onlyNums.replace(/\./g, ''));
      }
      return Number(onlyNums);
    }
    if (hasComma && !hasDot) {
      return Number(onlyNums.replace(',', '.'));
    }
    return Number(onlyNums);
  }

  get itemsFiltrados(): ItemListaProveedor[] {
    const t = (this.filtro || '').toLowerCase();
    if (!t) return this.itemsProveedor;
    return this.itemsProveedor.filter(it => it.codigo.toLowerCase().includes(t) || it.nombre.toLowerCase().includes(t));
  }

  get proveedoresFiltrados(): Proveedor[] {
    const t = (this.filtro || '').toLowerCase().trim();
    if (!t) return this.proveedores;
    return this.proveedores.filter(p =>
      (p.nombre || '').toLowerCase().includes(t) ||
      (p.ubicacion || '').toLowerCase().includes(t) ||
      (p.descripcion || '').toLowerCase().includes(t)
    );
  }

  agregarAlPedido(item: ItemListaProveedor): void {
    if (!this.tienePrecio(item)) { return; }
    const existente = this.pedido.find(p => p.codigo === item.codigo);
    if (existente) {
      existente.cantidad += 1;
    } else {
      this.pedido.push({ ...item, cantidad: 1 });
    }
  }

  quitarDelPedido(codigo: string): void {
    this.pedido = this.pedido.filter(p => p.codigo !== codigo);
  }

  totalPedido(): number {
    return this.pedido.reduce((acc, it) => acc + (Number(it.precio) * Number(it.cantidad)), 0);
  }

  tienePrecio(it: ItemListaProveedor): boolean {
    return Number.isFinite(Number(it.precio)) && Number(it.precio) > 0;
  }

  async exportarPedido(): Promise<void> {
    if (!this.proveedorSeleccionadoId) {
      this.toast.show('Seleccioná un proveedor.', 'error');
      return;
    }
    if (!this.pedido.length) {
      this.toast.show('No hay ítems en el pedido.', 'error');
      return;
    }
    const proveedor = this.proveedores.find(p => p.id === this.proveedorSeleccionadoId);
    const fecha = new Date();
    const data = this.pedido.map(it => ({
      Codigo: it.codigo,
      Nombre: it.nombre,
      Precio: Number(it.precio),
      Cantidad: Number(it.cantidad),
      Subtotal: Number((Number(it.precio) * Number(it.cantidad)).toFixed(2))
    }));
    const { utils, write } = await import('xlsx');
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Pedido');
    const fileName = `Pedido_${proveedor ? proveedor.nombre.replace(/\s+/g, '_') : 'Proveedor'}_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.xlsx`;

    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });

    const electronAPI = (window as any)?.electronAPI;
    if (electronAPI?.saveFile) {
      const result = await electronAPI.saveFile(wbout, {
        defaultPath: fileName,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      });
      if (result?.ok) {
        this.toast.show('Pedido exportado a Excel.');
      } else if (result?.canceled) {
        this.toast.show('Guardado cancelado.', 'info');
      } else {
        this.toast.show('No se pudo guardar el archivo.', 'error');
      }
    } else {
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const { saveAs } = await import('file-saver');
      saveAs(blob, fileName);
      this.toast.show('Pedido exportado a Excel.');
    }

    const itemsHist: PedidoItemProveedor[] = this.pedido.map(it => ({
      codigo: it.codigo,
      nombre: it.nombre,
      precio: Number(it.precio),
      cantidad: Number(it.cantidad),
      subtotal: Number((Number(it.precio) * Number(it.cantidad)).toFixed(2))
    }));
    this.db.agregarPedidoProveedor({ proveedorId: this.proveedorSeleccionadoId, items: itemsHist });
    this.cargarHistorial();
  }

  solicitarReemplazarListas(proveedorId: number): void {
    this.proveedorAReemplazarId = proveedorId;
  }

  confirmarReemplazarListas(): void {
    if (!this.proveedorAReemplazarId) return;
    const ok = this.db.vaciarListasProveedor(this.proveedorAReemplazarId);
    if (ok) {
      if (this.proveedorSeleccionadoId === this.proveedorAReemplazarId) {
        this.refrescarItems();
      }
      this.toast.show('Se reemplazaron las listas (datos borrados).', 'warning');
    }
    this.proveedorAReemplazarId = null;
  }

  cancelarReemplazarListas(): void {
    this.proveedorAReemplazarId = null;
  }

  toggleEntregado(p: { id: number; entregado: boolean; pagado: boolean }): void {
    this.db.actualizarPedidoFlags(p.id, { entregado: !p.entregado });
    this.cargarHistorial();
  }

  togglePagado(p: { id: number; entregado: boolean; pagado: boolean }): void {
    this.db.actualizarPedidoFlags(p.id, { pagado: !p.pagado });
    this.cargarHistorial();
  }

  eliminarPedido(id: number): void {
    const ok = this.db.eliminarPedidoProveedor(id);
    if (ok) {
      this.toast.show('Pedido eliminado.');
      this.cargarHistorial();
    }
  }
}