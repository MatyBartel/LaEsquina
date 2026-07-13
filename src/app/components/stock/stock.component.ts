import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { read, utils } from 'xlsx';
import { DatabaseService, Producto } from '../../services/database.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  templateUrl: './stock.component.html',
  styleUrls: ['./stock.component.scss']
})
export class StockComponent implements OnInit, OnDestroy {
  productos: Producto[] = [];
  filtroGeneral = '';
  ordenCampo: 'codigo' | 'nombre' | 'categoria' | 'proveedor' | 'precio' | 'stock' = 'nombre';
  ordenAsc = true;
  categorias: string[] = [];
  categoriaFiltro: string = '';
  private sub?: Subscription;
  private subCategorias?: Subscription;
  productoDetalle: Producto | null = null;
  productoAEliminar: Producto | null = null;
  mostrarCargaExcel = false;
  archivoExcel: File | null = null;
  resumenCarga = '';
  ultimaImportacionIds: number[] = [];
  resumenValidaciones = '';

  showMassPrice = false;
  seleccionados = new Set<number>();
  categoriaAumento = '';
  cantidadStock = 0;
  codigosDuplicados: string[] = [];
  page = 1;
  pageSize = 10;
  eliminarNoPresentes = false;

  loading: { visible: boolean; done: boolean; title: string; summary: any } = {
    visible: false,
    done: false,
    title: '',
    summary: {}
  };

  constructor(private db: DatabaseService, private toast: ToastService) {}

  ngOnInit(): void {
    this.sub = this.db.getProductos().subscribe(items => {
      this.productos = items;
    });
    this.subCategorias = this.db.getCategorias().subscribe(list => {
      this.categorias = list;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.subCategorias?.unsubscribe();
  }

  trackByProducto(_idx: number, p: Producto): number | string {
    return p.id || p.codigo;
  }

  setOrden(campo: 'codigo' | 'nombre' | 'categoria' | 'proveedor' | 'precio' | 'stock'): void {
    if (this.ordenCampo === campo) {
      this.ordenAsc = !this.ordenAsc;
    } else {
      this.ordenCampo = campo;
      this.ordenAsc = true;
    }
  }

  get productosVista(): Producto[] {
    const term = (this.filtroGeneral || '').toLowerCase();
    let arr = this.productos.filter(p =>
      p.codigo.toLowerCase().includes(term) ||
      p.nombre.toLowerCase().includes(term) ||
      p.categoria.toLowerCase().includes(term) ||
      (p.proveedor || '').toLowerCase().includes(term)
    );

    if (this.categoriaFiltro) {
      arr = arr.filter(p => p.categoria === this.categoriaFiltro);
    }

    arr = arr.sort((a, b) => {
      const campo = this.ordenCampo;
      let va: any = (a as any)[campo];
      let vb: any = (b as any)[campo];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      const comp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.ordenAsc ? comp : -comp;
    });

    // Paginación
    const total = arr.length;
    const maxPage = Math.max(1, Math.ceil(total / this.pageSize));
    if (this.page > maxPage) this.page = maxPage;
    const start = (this.page - 1) * this.pageSize;
    return arr.slice(start, start + this.pageSize);
  }

  get totalFiltrados(): number {
    const term = (this.filtroGeneral || '').toLowerCase();
    let arr = this.productos.filter(p =>
      p.codigo.toLowerCase().includes(term) ||
      p.nombre.toLowerCase().includes(term) ||
      p.categoria.toLowerCase().includes(term) ||
      (p.proveedor || '').toLowerCase().includes(term)
    );
    if (this.categoriaFiltro) arr = arr.filter(p => p.categoria === this.categoriaFiltro);
    return arr.length;
  }

  setPageSize(size: number): void {
    this.pageSize = Math.max(10, Math.min(500, Math.trunc(size)));
    this.page = 1;
  }

  goToPage(p: number): void {
    const max = Math.max(1, Math.ceil(this.totalFiltrados / this.pageSize));
    this.page = Math.max(1, Math.min(max, Math.trunc(p)));
  }

  // Getters para plantilla (evitar usar Math.* en HTML)
  get paginaDesde(): number {
    if (this.totalFiltrados === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }
  get paginaHasta(): number {
    const fin = this.page * this.pageSize;
    return fin > this.totalFiltrados ? this.totalFiltrados : fin;
  }

  solicitarEliminar(p: Producto): void {
    this.productoAEliminar = p;
  }

  cancelarEliminar(): void {
    this.productoAEliminar = null;
  }

  confirmarEliminar(): void {
    const p = this.productoAEliminar;
    if (!p || !p.id) { this.productoAEliminar = null; return; }
    this.db.eliminarProducto(p.id);
    this.productoAEliminar = null;
    this.toast.show('Producto eliminado', 'info');
  }

  abrirCargaExcel(): void {
    this.mostrarCargaExcel = true;
    this.archivoExcel = null;
    this.resumenCarga = '';
  }

  cancelarCargaExcel(): void {
    this.mostrarCargaExcel = false;
    this.archivoExcel = null;
    this.resumenCarga = '';
  }

  onArchivoExcelSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.archivoExcel = files && files.length ? files[0] : null;
  }

  async procesarExcel(): Promise<void> {
    if (!this.archivoExcel) return;
    try {
      this.startLoading('Cargando productos');
      await new Promise(r => setTimeout(r));
      const buffer = await this.archivoExcel.arrayBuffer();
      const wb = read(new Uint8Array(buffer), { type: 'array' });

      const rowsAll: any[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const rows: any[] = utils.sheet_to_json(ws, { defval: '' });
        rowsAll.push(...rows);
      }

      const vistos = new Set<string>();
      const duplicados: string[] = [];
      const productosParaUpsert: Producto[] = [];
      let sinPrecioCalculable = 0;
      const codigosSinPrecio: string[] = [];
      let sinCodigoCount = 0;
      const sinCodigoNombres: string[] = [];
      let procesados = 0;

      for (const row of rowsAll) {
        procesados++;
        const normalized: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) normalized[String(k).trim().toLowerCase()] = v;
        const stockRaw = Object.entries(normalized).find(([kk]) => kk.includes('stock'))?.[1];
        const stockNum = Number(String(stockRaw ?? '').toString().replace(/[^0-9.-]/g, '').replace(',', '.'));

        const codigoRawEntry = Object.entries(normalized).find(([kk]) => kk.includes('codigo'))?.[1];
        const codigoRaw = String(codigoRawEntry ?? '').trim();
        if (!codigoRaw) {
          sinCodigoCount++;
          const nameCandidate = String(Object.entries(normalized).find(([kk]) => kk.includes('nombre'))?.[1] ?? '').trim();
          if (nameCandidate) sinCodigoNombres.push(nameCandidate);
          continue;
        }

        const p = this.mapRowToProducto(row);
        if (!p) continue;
        const codigo = (p.codigo || '').trim();
        if (codigo && vistos.has(codigo)) { duplicados.push(codigo); continue; }
        if (codigo) vistos.add(codigo);
        if (!isNaN(stockNum)) p.stock = Math.max(0, Math.trunc(stockNum));
        if (!p.precio || !isFinite(p.precio) || p.precio <= 0) {
          sinPrecioCalculable++;
          if (codigo) codigosSinPrecio.push(codigo);
        }
        productosParaUpsert.push(p);
        if (procesados % 500 === 0) { await new Promise(r => setTimeout(r)); }
      }

      const res = this.db.upsertProductosPorCodigoEnBloque(productosParaUpsert, { keepExistingStock: true });

      // Borrado de no presentes
      let eliminados = 0;
      let codigosEliminados: string[] = [];
      if (this.eliminarNoPresentes) {
        const codigosExcel = new Set(productosParaUpsert.map(p => (p.codigo || '').trim()).filter(Boolean));
        const actuales = this.db.getProductosActuales();
        const codigosSistema = actuales.map(p => (p.codigo || '').trim()).filter(Boolean);
        const paraEliminar = codigosSistema.filter(c => !codigosExcel.has(c));
        if (paraEliminar.length) {
          eliminados = this.db.eliminarProductosPorCodigoEnBloque(paraEliminar);
          codigosEliminados = paraEliminar.slice(0, 1000);
        }
      }
      this.ultimaImportacionIds = [];
      this.codigosDuplicados = Array.from(new Set(duplicados));
      const dupTxt = this.codigosDuplicados.length ? ` • Duplicados en archivo: ${this.codigosDuplicados.length}` : '';
      const sinPrecioTxt = sinPrecioCalculable ? ` • Sin precio calculable: ${sinPrecioCalculable}` : '';
      const sinCodigoTxt = sinCodigoCount ? ` • Sin código: ${sinCodigoCount}` : '';
      const elimTxt = eliminados ? ` • Eliminados: ${eliminados}` : '';
      this.resumenCarga = `Procesados: ${procesados}. Nuevos: ${res.created}. Actualizados: ${res.updated}.${dupTxt}${sinPrecioTxt}${sinCodigoTxt}${elimTxt}`;
      const detallesSinPrecio = sinPrecioCalculable ? `Sin precio (ej.): ${codigosSinPrecio.slice(0,20).join(', ')}${sinPrecioCalculable>20?'...':''}` : '';
      const detallesDup = this.codigosDuplicados.length ? `Duplicados: ${this.codigosDuplicados.slice(0,20).join(', ')}${this.codigosDuplicados.length>20?'...':''}` : '';
      const detallesSinCodigo = sinCodigoCount ? `Sin código (ej. nombres): ${sinCodigoNombres.slice(0,20).join(', ')}${sinCodigoNombres.length>20?'...':''}` : '';
      const detallesElim = eliminados ? `Eliminados: ${codigosEliminados.join(', ')}` : '';
      this.resumenValidaciones = [detallesDup, detallesSinPrecio, detallesSinCodigo, detallesElim].filter(Boolean).join(' · ');
      this.toast.show(`Procesados: ${procesados}. Nuevos: ${res.created}. Actualizados: ${res.updated}.${sinPrecioTxt}${sinCodigoTxt}${elimTxt}`, 'success');
      this.mostrarCargaExcel = false;
      this.finishLoadingSuccess({ nuevos: res.created, actualizados: res.updated, duplicados: this.codigosDuplicados, sinPrecio: codigosSinPrecio, sinCodigoCount, sinCodigoNombres, eliminados });
    } catch (e) {
      this.toast.show('No se pudo leer el Excel. Verificá el formato.', 'error');
      this.loading.visible = false;
    }
  }

  async eliminarSeleccionados(): Promise<void> {
    if (!this.seleccionados.size) return;
    const ok = await this.toast.confirm(`¿Eliminar ${this.seleccionados.size} producto(s) seleccionados?`, 'warning');
    if (!ok) { this.toast.show('Operación cancelada', 'info'); return; }
    const ids = Array.from(this.seleccionados.values());
    for (const id of ids) {
      this.db.eliminarProducto(id);
    }
    this.seleccionados.clear();
    this.toast.show(`Eliminados ${ids.length} producto(s).`, 'info');
  }

  deshacerUltimaImportacion(): void {
    if (!this.ultimaImportacionIds.length) return;
    let count = 0;
    for (const id of this.ultimaImportacionIds) {
      this.db.eliminarProducto(id);
      count++;
    }
    this.ultimaImportacionIds = [];
    this.toast.show(`Se deshizo la última importación. Eliminados ${count}.`, 'info');
  }

  private mapRowToProducto(row: any): Producto | null {
    const get = (keys: string[]): string => {
      const normalized: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[String(k).trim().toLowerCase()] = v;
      }
      for (const k of keys) {
        const key = k.toLowerCase();
        const entry = Object.entries(normalized).find(([kk]) => kk.includes(key));
        if (entry) return String(entry[1] ?? '').trim();
      }
      return '';
    };

    const codigo = get(['codigo']);
    const nombre = get(['nombre']);
    const categoria = get(['categoria']);
    const costoStr = get(['precio de costo','costo']);
    const pctStr = get(['porcentaje ganancia','% ganancia','ganancia']);
    const proveedor = get(['proveedor']);
    const descripcion = get(['descripcion','descripción']);
    // Requerir código, si no hay, no crear producto
    if (!codigo) return null;
    const costo = Number(String(costoStr).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    const pct = Number(String(pctStr).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    const precio = Number((costo * (1 + pct / 100)).toFixed(2));
    const producto: Producto = {
      codigo: codigo,
      nombre: nombre || codigo,
      descripcion: descripcion || '',
      precio: precio,
      stock: 0,
      stockMinimo: 0,
      categoria: categoria || '',
      proveedor: proveedor || '',
      fechaCreacion: new Date(),
      caracteristicas: {
        ...(costo ? { precioCosto: String(costo) } : {}),
        ...(pct ? { gananciaPct: String(pct) } : {})
      }
    };
    return producto;
  }

  private toNumber(v: any, def: number = 0): number {
    const n = Number(String(v ?? '').toString().replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return isNaN(n) ? def : n;
  }

  getCosto(p: Producto): number {
    const attrs = p.caracteristicas || {};
    const costoAttr = this.toNumber((attrs as any).precioCosto, NaN);
    if (!isNaN(costoAttr)) return costoAttr;
    const pct = this.toNumber((attrs as any).gananciaPct, NaN);
    if (!isNaN(pct) && pct > -100) {
      const costo = p.precio / (1 + pct / 100);
      return Number(costo.toFixed(2));
    }
    return p.precio; // fallback: sin datos, igual a precio
  }

  getGananciaPct(p: Producto): number {
    const attrs = p.caracteristicas || {};
    const pct = this.toNumber((attrs as any).gananciaPct, NaN);
    if (!isNaN(pct)) return Number(pct.toFixed(2));
    const costoAttr = this.toNumber((attrs as any).precioCosto, NaN);
    if (!isNaN(costoAttr) && costoAttr > 0) {
      const calc = ((p.precio - costoAttr) / costoAttr) * 100;
      return Number(calc.toFixed(2));
    }
    return 0;
  }

  verInfo(p: Producto): void {
    this.productoDetalle = p;
  }

  cerrarInfo(): void {
    this.productoDetalle = null;
  }

  toggleSeleccion(id?: number): void {
    if (!id) return;
    if (this.seleccionados.has(id)) this.seleccionados.delete(id); else this.seleccionados.add(id);
  }

  seleccionarTodosVista(): void {
    for (const p of this.productosVista) {
      if (p.id) this.seleccionados.add(p.id);
    }
  }

  limpiarSeleccion(): void {
    this.seleccionados.clear();
  }

  async aplicarAumento(): Promise<void> {
    const porSeleccion = this.seleccionados.size > 0;
    const porCategoria = !!this.categoriaAumento;

    const cant = Math.trunc(Number(this.cantidadStock));
    if (!isFinite(cant) || cant === 0) { this.toast.show('Ingresá una cantidad de stock válida (entero distinto de 0).', 'error'); return; }
    const afectadas: Producto[] = [];
    this.startLoading('Aplicando cambios');
    await new Promise(r => setTimeout(r));
    for (const p of this.productos) {
      const matchSel = porSeleccion && p.id ? this.seleccionados.has(p.id) : false;
      const matchCat = porCategoria ? p.categoria === this.categoriaAumento : false;
      const aplicar = (porSeleccion && matchSel) || (porCategoria && matchCat) || (!porSeleccion && !porCategoria);
      if (aplicar) {
        const nuevoStock = Math.max(0, (p.stock || 0) + cant);
        const nuevo = { ...p, stock: nuevoStock };
        afectadas.push(nuevo);
      }
    }
    if (!afectadas.length) { this.toast.show('No hay productos que coincidan con la selección.', 'warning'); this.cerrarLoading(); return; }
    const count = this.db.actualizarProductosEnBloquePorId(afectadas);
    const scopeTxt = porSeleccion ? 'seleccionados' : (porCategoria ? `categoría "${this.categoriaAumento}"` : 'todos los productos filtrados');
    this.toast.show(`Stock actualizado (±${cant} en ${count} productos, ${scopeTxt}).`);
    this.showMassPrice = false;
    this.limpiarSeleccion();
    this.finishLoadingSuccess({ modificados: count });
  }

  onStockChange(p: Producto, value: any): void {
    const raw = String(value ?? '');
    const num = Number(raw.replace(/[^0-9.-]/g, '').replace(',', '.'));
    const entero = Math.max(0, Math.trunc(isNaN(num) ? 0 : num));
    p.stock = entero;
  }

  onStockBlur(p: Producto): void {
    const val = Math.max(0, Math.trunc(Number(p.stock || 0)));
    if (p.stock !== val) p.stock = val;
    this.db.actualizarProducto(p);
  }

  private startLoading(title: string): void {
    this.loading = { visible: true, done: false, title, summary: {} };
  }

  private finishLoadingSuccess(summary: any): void {
    this.loading = { ...this.loading, done: true, summary };
  }

  cerrarLoading(): void {
    this.loading = { visible: false, done: false, title: '', summary: {} };
  }
}