import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Producto {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  categoria: string;
  proveedor: string;
  fechaCreacion: Date;
  caracteristicas?: Record<string, string>;
}

export interface Venta {
  id?: number;
  numeroTicket: string;
  fecha: Date;
  productos: VentaProducto[];
  total: number;
  redondeo?: number;
  totalManual?: number;
  descuentoPct?: number;
  descuentoMonto?: number;
  metodoPago: string;
  pagos?: PagoVenta[];
  cliente?: string;
  vendedor: string;
  vuelto?: number;
}

export interface VentaProducto {
  productoId: number;
  codigo: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PagoVenta {
  metodo: string;
  monto: number;
  referencia?: string;
}

export interface ItemListaProveedor {
  codigo: string;
  nombre: string;
  precio: number;
}

export interface ListaPreciosProveedor {
  id: number;
  proveedorId: number;
  nombreArchivo: string;
  fechaCarga: Date;
  items: ItemListaProveedor[];
}

export interface Proveedor {
  id: number;
  nombre: string;
  ubicacion: string;
  descripcion: string;
  listas: ListaPreciosProveedor[];
}

export interface PedidoItemProveedor {
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

export interface PedidoProveedor {
  id: number;
  proveedorId: number;
  fecha: Date;
  items: PedidoItemProveedor[];
  total: number;
  entregado: boolean;
  pagado: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private productosSubject = new BehaviorSubject<Producto[]>([]);
  private ventasSubject = new BehaviorSubject<Venta[]>([]);
  private categoriasSubject = new BehaviorSubject<string[]>([]);
  private vendedoresSubject = new BehaviorSubject<string[]>([]);
  private proveedoresSubject = new BehaviorSubject<Proveedor[]>([]);
  private pedidosSubject = new BehaviorSubject<PedidoProveedor[]>([]);

  productos$ = this.productosSubject.asObservable();
  ventas$ = this.ventasSubject.asObservable();
  categorias$ = this.categoriasSubject.asObservable();
  vendedores$ = this.vendedoresSubject.asObservable();
  proveedores$ = this.proveedoresSubject.asObservable();
  pedidos$ = this.pedidosSubject.asObservable();

  constructor() {
    this.inicializarBaseDatos();
  }

  private inicializarBaseDatos(): void {
    const electronAPI: any = (typeof window !== 'undefined') ? (window as any).electronAPI : null;
    if (electronAPI?.kvGet) {
      this.cargarDesdeSqlite();
      return;
    }
    this.inicializarEjemplo();
  }

  private async cargarDesdeSqlite(): Promise<void> {
    try {
      const electronAPI: any = (window as any)?.electronAPI;
      if (!electronAPI || typeof electronAPI.kvGet !== 'function') {
        this.inicializarEjemplo();
        return;
      }
      const productos = JSON.parse((await electronAPI.kvGet('productos')) || '[]');
      const ventas = JSON.parse((await electronAPI.kvGet('ventas')) || '[]');
      const categorias = JSON.parse((await electronAPI.kvGet('categorias')) || '[]');
      const vendedores = JSON.parse((await electronAPI.kvGet('vendedores')) || '[]');
      const proveedores = JSON.parse((await electronAPI.kvGet('proveedores')) || '[]');
      const pedidos = JSON.parse((await electronAPI.kvGet('pedidos')) || '[]');

      productos.forEach((p: any) => p.fechaCreacion && (p.fechaCreacion = new Date(p.fechaCreacion)));
      ventas.forEach((v: any) => v.fecha && (v.fecha = new Date(v.fecha)));
      pedidos.forEach((p: any) => p.fecha && (p.fecha = new Date(p.fecha)));

      this.productosSubject.next(productos);
      this.ventasSubject.next(ventas);
      this.categoriasSubject.next(categorias);
      this.vendedoresSubject.next(vendedores.length ? vendedores : ['Vendedor 1']);
      this.proveedoresSubject.next(proveedores);
      this.pedidosSubject.next(pedidos);
    } catch { this.inicializarEjemplo(); }
  }

  private inicializarEjemplo(): void {
    const productosEjemplo: Producto[] = [
      {
        id: 1,
        codigo: 'MART-001',
        nombre: 'Martillo 16oz',
        descripcion: 'Martillo de acero con mango de madera',
        precio: 25.99,
        stock: 50,
        stockMinimo: 10,
        categoria: 'Herramientas Manuales',
        proveedor: 'Herramientas Pro',
        fechaCreacion: new Date()
      },
      {
        id: 2,
        codigo: 'DEST-001',
        nombre: 'Destornillador Phillips #2',
        descripcion: 'Destornillador Phillips de 6 pulgadas',
        precio: 8.50,
        stock: 100,
        stockMinimo: 20,
        categoria: 'Herramientas Manuales',
        proveedor: 'Herramientas Pro',
        fechaCreacion: new Date()
      }
    ];

    const ventasEjemplo: Venta[] = [
      {
        id: 1,
        numeroTicket: 'T001-2024',
        fecha: new Date(),
        productos: [
          {
            productoId: 1,
            codigo: 'MART-001',
            nombre: 'Martillo 16oz',
            cantidad: 1,
            precioUnitario: 25.99,
            subtotal: 25.99
          }
        ],
        total: 25.99,
        metodoPago: 'Efectivo',
        vendedor: 'Vendedor 1'
      }
    ];

    this.productosSubject.next(productosEjemplo);
    this.ventasSubject.next(ventasEjemplo);
    this.vendedoresSubject.next(['Vendedor 1']);
    this.proveedoresSubject.next([]);
    this.pedidosSubject.next([]);

    const categoriasUnicas = Array.from(
      new Set(productosEjemplo.map(p => p.categoria.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    this.categoriasSubject.next(categoriasUnicas);
  }

  private persistirProductos(): void {
    this.persistirSqliteKv('productos', this.productosSubject.value);
  }

  private persistirVentas(): void {
    this.persistirSqliteKv('ventas', this.ventasSubject.value);
  }

  private persistirCategorias(): void {
    this.persistirSqliteKv('categorias', this.categoriasSubject.value);
  }

  private persistirVendedores(): void {
    this.persistirSqliteKv('vendedores', this.vendedoresSubject.value);
  }

  private persistirProveedores(): void {
    this.persistirSqliteKv('proveedores', this.proveedoresSubject.value);
  }

  private persistirPedidos(): void {
    this.persistirSqliteKv('pedidos', this.pedidosSubject.value);
  }

  getProductos(): Observable<Producto[]> {
    return this.productos$;
  }

  getProductoById(id: number): Producto | undefined {
    return this.productosSubject.value.find(p => p.id === id);
  }

  getProductoByCodigo(codigo: string): Producto | undefined {
    return this.productosSubject.value.find(p => p.codigo === codigo);
  }

  agregarProducto(producto: Producto): void {
    const productos = this.productosSubject.value;
    const nextId = productos.length ? Math.max(...productos.map(p => p.id || 0)) + 1 : 1;
    producto.id = nextId;
    producto.fechaCreacion = new Date();
    this.productosSubject.next([...productos, producto]);

    const categorias = this.categoriasSubject.value;
    const cat = (producto.categoria || '').trim();
    if (cat && !categorias.map(c => c.toLowerCase()).includes(cat.toLowerCase())) {
      this.categoriasSubject.next([...categorias, cat].sort((a, b) => a.localeCompare(b)));
    }

    this.persistirProductos();
    this.persistirCategorias();
    this.persistirSqliteKv('productos', this.productosSubject.value);
    this.persistirSqliteKv('categorias', this.categoriasSubject.value);
  }

  actualizarProducto(producto: Producto): void {
    const productos = this.productosSubject.value;
    const index = productos.findIndex(p => p.id === producto.id);
    if (index !== -1) {
      productos[index] = { ...producto };
      this.productosSubject.next([...productos]);
      this.persistirProductos();
      this.persistirSqliteKv('productos', this.productosSubject.value);
    }
  }

  actualizarProductosEnBloquePorId(actualizados: Producto[]): number {
    if (!Array.isArray(actualizados) || !actualizados.length) return 0;
    const productos = this.productosSubject.value;
    const idToIndex = new Map<number, number>();
    for (let i = 0; i < productos.length; i++) {
      const id = productos[i].id;
      if (typeof id === 'number') idToIndex.set(id, i);
    }
    let count = 0;
    for (const nuevo of actualizados) {
      const id = nuevo.id;
      if (typeof id !== 'number') continue;
      const idx = idToIndex.get(id);
      if (idx === undefined) continue;
      const actual = productos[idx];
      const changed = (
        actual.nombre !== nuevo.nombre ||
        actual.descripcion !== nuevo.descripcion ||
        actual.categoria !== nuevo.categoria ||
        actual.proveedor !== nuevo.proveedor ||
        actual.precio !== nuevo.precio ||
        actual.stock !== nuevo.stock ||
        actual.stockMinimo !== nuevo.stockMinimo ||
        JSON.stringify(actual.caracteristicas || {}) !== JSON.stringify(nuevo.caracteristicas || {})
      );
      if (!changed) continue;
      productos[idx] = { ...nuevo };
      count++;
    }
    if (count > 0) {
      this.productosSubject.next([...productos]);
      this.persistirProductos();
      this.persistirSqliteKv('productos', this.productosSubject.value);
    }
    return count;
  }

  eliminarProducto(id: number): void {
    const productos = this.productosSubject.value;
    this.productosSubject.next(productos.filter(p => p.id !== id));
    this.persistirProductos();
    this.persistirSqliteKv('productos', this.productosSubject.value);
  }

  eliminarProductosPorCodigoEnBloque(codigos: string[]): number {
    if (!Array.isArray(codigos) || !codigos.length) return 0;
    const set = new Set(codigos.map(c => (c || '').trim()).filter(Boolean));
    if (!set.size) return 0;
    const antes = this.productosSubject.value;
    const despues = antes.filter(p => !set.has((p.codigo || '').trim()));
    const eliminados = antes.length - despues.length;
    if (eliminados <= 0) return 0;
    this.productosSubject.next(despues);

    const categoriasUnicas = Array.from(
      new Set(despues.map(p => (p.categoria || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    this.categoriasSubject.next(categoriasUnicas);

    this.persistirProductos();
    this.persistirCategorias();
    this.persistirSqliteKv('productos', this.productosSubject.value);
    this.persistirSqliteKv('categorias', this.categoriasSubject.value);
    return eliminados;
  }

  actualizarStocksPorCodigoBatch(updates: Record<string, number>): { updated: number; unknown: string[] } {
    const productos = this.productosSubject.value;
    if (!updates || typeof updates !== 'object') return { updated: 0, unknown: [] };
    const codigoToIndex = new Map<string, number>();
    for (let i = 0; i < productos.length; i++) {
      const c = (productos[i].codigo || '').trim();
      if (c) codigoToIndex.set(c, i);
    }
    const unknown: string[] = [];
    let updatedCount = 0;
    for (const [codigoRaw, stockVal] of Object.entries(updates)) {
      const codigo = (codigoRaw || '').trim();
      const idx = codigoToIndex.get(codigo);
      if (idx === undefined) { unknown.push(codigo); continue; }
      const nuevoStock = Math.max(0, Math.trunc(Number(stockVal || 0)));
      if (!isFinite(nuevoStock)) { continue; }
      if (productos[idx].stock !== nuevoStock) {
        productos[idx] = { ...productos[idx], stock: nuevoStock };
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      this.productosSubject.next([...productos]);
      this.persistirProductos();
      this.persistirSqliteKv('productos', this.productosSubject.value);
    }
    return { updated: updatedCount, unknown };
  }

  /**
   * Inserta o actualiza muchos productos de una sola vez, identificándolos por su código.
   * - Si el producto existe (mismo código), actualiza campos básicos y mantiene el stock actual por defecto.
   * - Si no existe, lo crea asignando un id nuevo y respetando el stock provisto en la entrada.
   * - Emite una única vez a los observers y persiste una sola vez para mejorar el rendimiento.
   */
  upsertProductosPorCodigoEnBloque(entries: Producto[], opciones?: { keepExistingStock?: boolean }): { created: number; updated: number } {
    const keepExistingStock = opciones?.keepExistingStock !== false;
    const actuales = this.productosSubject.value;
    const productos = [...actuales];
    let created = 0;
    let updated = 0;

    // Mapear códigos existentes a sus índices y calcular próximo id
    const codigoToIndex = new Map<string, number>();
    let maxId = 0;
    for (let i = 0; i < productos.length; i++) {
      const p = productos[i];
      const c = (p.codigo || '').trim();
      if (c) codigoToIndex.set(c, i);
      if (typeof p.id === 'number') maxId = Math.max(maxId, p.id);
    }

    for (const entry of entries) {
      const codigo = (entry.codigo || '').trim();
      if (!codigo) continue;
      const idx = codigoToIndex.get(codigo);
      if (idx !== undefined) {
        const existente = productos[idx];
        const merged: Producto = {
          ...existente,
          // mantener id y fecha
          nombre: entry.nombre ?? existente.nombre,
          categoria: entry.categoria ?? existente.categoria,
          proveedor: entry.proveedor ?? existente.proveedor,
          descripcion: entry.descripcion ?? existente.descripcion,
          precio: typeof entry.precio === 'number' ? entry.precio : existente.precio,
          // stock: mantener el existente a menos que se indique lo contrario
          stock: keepExistingStock ? existente.stock : (typeof entry.stock === 'number' ? entry.stock : existente.stock),
          // no pisar stockMinimo a menos que venga explícito en entry
          stockMinimo: typeof entry.stockMinimo === 'number' ? entry.stockMinimo : existente.stockMinimo,
          caracteristicas: {
            ...(existente.caracteristicas || {}),
            ...(entry.caracteristicas || {})
          }
        };
        const changed = (
          merged.nombre !== existente.nombre ||
          merged.categoria !== existente.categoria ||
          merged.proveedor !== existente.proveedor ||
          merged.descripcion !== existente.descripcion ||
          merged.precio !== existente.precio ||
          merged.stock !== existente.stock ||
          merged.stockMinimo !== existente.stockMinimo ||
          JSON.stringify(merged.caracteristicas || {}) !== JSON.stringify(existente.caracteristicas || {})
        );
        if (changed) {
          productos[idx] = merged;
          updated++;
        }
      } else {
        const nuevo: Producto = {
          ...entry,
          id: ++maxId,
          fechaCreacion: new Date(entry.fechaCreacion || new Date())
        };
        productos.push(nuevo);
        if (codigo) codigoToIndex.set(codigo, productos.length - 1);
        created++;
      }
    }

    // Actualizar subjects una sola vez
    this.productosSubject.next(productos);

    // Recalcular categorías únicas basadas en productos actuales
    const categoriasUnicas = Array.from(
      new Set(productos.map(p => (p.categoria || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    this.categoriasSubject.next(categoriasUnicas);

    // Persistir de una vez
    this.persistirProductos();
    this.persistirCategorias();
    this.persistirSqliteKv('productos', this.productosSubject.value);
    this.persistirSqliteKv('categorias', this.categoriasSubject.value);

    return { created, updated };
  }

  actualizarStock(id: number, cantidad: number): void {
    const productos = this.productosSubject.value;
    const index = productos.findIndex(p => p.id === id);
    if (index !== -1) {
      productos[index].stock += cantidad;
      this.productosSubject.next([...productos]);
      this.persistirProductos();
    }
  }

  getVentas(): Observable<Venta[]> {
    return this.ventas$;
  }

  getVentasActuales(): Venta[] {
    return this.ventasSubject.value;
  }

  getProductosActuales(): Producto[] {
    return this.productosSubject.value;
  }

  getVentaById(id: number): Venta | undefined {
    return this.ventasSubject.value.find(v => v.id === id);
  }

  crearVenta(venta: Venta): boolean {
    const ventas = this.ventasSubject.value;
    venta.id = Math.max(...ventas.map(v => v.id || 0)) + 1;
    for (const vp of venta.productos) {
      const p = this.getProductoById(vp.productoId);
      if (!p || (p.stock - vp.cantidad) < 0) {
        return false;
      }
    }
    let total = 0;
    venta.productos.forEach(vp => {
      vp.subtotal = Number(vp.cantidad) * Number(vp.precioUnitario);
      total += vp.subtotal;
      this.actualizarStock(vp.productoId, -vp.cantidad);
    });
    let descuento = 0;
    if (typeof venta.descuentoPct === 'number' && !isNaN(venta.descuentoPct)) {
      descuento = total * (Number(venta.descuentoPct) / 100);
      venta.descuentoMonto = Number(descuento.toFixed(2));
    } else if (typeof venta.descuentoMonto === 'number' && !isNaN(venta.descuentoMonto)) {
      descuento = Number(venta.descuentoMonto);
    }
    const base = Math.max(0, Number((total - descuento).toFixed(2)));
    const redondeo = Number(venta.redondeo || 0);
    const totalManualVal = Number((venta as any).totalManual || 0);
    if (!isNaN(totalManualVal) && totalManualVal > 0) {
      venta.total = Math.max(0, Math.round(totalManualVal));
    } else {
      venta.total = Math.max(0, Math.round(base + redondeo));
    }
    if (!venta.pagos) { venta.pagos = []; }

    this.ventasSubject.next([...ventas, venta]);
    this.persistirVentas();
    this.persistirSqliteKv('productos', this.productosSubject.value);
    this.persistirSqliteKv('ventas', this.ventasSubject.value);
    return true;
  }

  eliminarVenta(id: number, restock: boolean = true): void {
    const venta = this.getVentaById(id);
    if (!venta) return;
    if (restock) {
      for (const vp of venta.productos) {
        this.actualizarStock(vp.productoId, vp.cantidad);
      }
    }
    const ventas = this.ventasSubject.value.filter(v => v.id !== id);
    this.ventasSubject.next(ventas);
    this.persistirVentas();
    this.persistirSqliteKv('productos', this.productosSubject.value);
    this.persistirSqliteKv('ventas', this.ventasSubject.value);
  }

  buscarProductos(termino: string): Producto[] {
    const productos = this.productosSubject.value;
    return productos.filter(p => 
      p.nombre.toLowerCase().includes(termino.toLowerCase()) ||
      p.codigo.toLowerCase().includes(termino.toLowerCase()) ||
      p.categoria.toLowerCase().includes(termino.toLowerCase())
    );
  }

  getProductosBajoStock(): Producto[] {
    return this.productosSubject.value.filter(p => p.stock <= p.stockMinimo);
  }

  getVentasPorFecha(fechaInicio: Date, fechaFin: Date): Venta[] {
    return this.ventasSubject.value.filter(v => 
      v.fecha >= fechaInicio && v.fecha <= fechaFin
    );
  }

  getTotalVentas(fechaInicio: Date, fechaFin: Date): number {
    const ventas = this.getVentasPorFecha(fechaInicio, fechaFin);
    return ventas.reduce((total, venta) => total + venta.total, 0);
  }

  getVentasUltimas24h(): Venta[] {
    const ahora = new Date();
    const inicio = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    return this.getVentasPorFecha(inicio, ahora).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  getSumaPagosPorMetodo(fechaInicio: Date, fechaFin: Date): Record<string, number> {
    const ventas = this.getVentasPorFecha(fechaInicio, fechaFin);
    const mapa: Record<string, number> = {};
    for (const v of ventas) {
      for (const p of v.pagos || []) {
        const key = (p.metodo || 'Desconocido').trim();
        mapa[key] = (mapa[key] || 0) + Number(p.monto || 0);
      }
    }
    return mapa;
  }

  getCategorias(): Observable<string[]> {
    return this.categorias$;
  }

  agregarCategoria(nombre: string): void {
    const n = (nombre || '').trim();
    if (!n) return;
    const categorias = this.categoriasSubject.value;
    if (!categorias.map(c => c.toLowerCase()).includes(n.toLowerCase())) {
      this.categoriasSubject.next([...categorias, n].sort((a, b) => a.localeCompare(b)));
      this.persistirCategorias();
    }
  }

  countProductosPorCategoria(nombre: string): number {
    const n = (nombre || '').trim().toLowerCase();
    if (!n) return 0;
    return this.productosSubject.value.filter(p => (p.categoria || '').trim().toLowerCase() === n).length;
  }

  eliminarCategoria(nombre: string): boolean {
    const n = (nombre || '').trim();
    if (!n) return false;
    const enUso = this.countProductosPorCategoria(n) > 0;
    if (enUso) return false;
    const nuevas = this.categoriasSubject.value.filter(c => c.toLowerCase() !== n.toLowerCase());
    this.categoriasSubject.next(nuevas);
    this.persistirCategorias();
    return true;
  }

  getVendedores(): Observable<string[]> {
    return this.vendedores$;
  }

  getVendedoresActuales(): string[] {
    return this.vendedoresSubject.value;
  }

  agregarVendedor(nombre: string): boolean {
    const n = (nombre || '').trim();
    if (!n) return false;
    const actuales = this.vendedoresSubject.value;
    if (actuales.some(v => v.toLowerCase() === n.toLowerCase())) return false;
    this.vendedoresSubject.next([...actuales, n]);
    this.persistirVendedores();
    this.persistirSqliteKv('vendedores', this.vendedoresSubject.value);
    return true;
  }

  eliminarVendedor(nombre: string): boolean {
    const n = (nombre || '').trim();
    if (!n) return false;
    const actuales = this.vendedoresSubject.value;
    const restantes = actuales.filter(v => v.toLowerCase() !== n.toLowerCase());
    if (restantes.length === actuales.length) return false;
    this.vendedoresSubject.next(restantes);
    this.persistirVendedores();
    this.persistirSqliteKv('vendedores', this.vendedoresSubject.value);
    return true;
  }

  getProveedores(): Observable<Proveedor[]> {
    return this.proveedores$;
  }

  getProveedoresActuales(): Proveedor[] {
    return this.proveedoresSubject.value;
  }

  agregarProveedor(data: { nombre: string; ubicacion: string; descripcion: string; }): Proveedor | null {
    const nombre = (data.nombre || '').trim();
    if (!nombre) return null;
    const actuales = this.proveedoresSubject.value;
    const nextId = actuales.length ? Math.max(...actuales.map(p => p.id)) + 1 : 1;
    const proveedor: Proveedor = {
      id: nextId,
      nombre,
      ubicacion: (data.ubicacion || '').trim(),
      descripcion: (data.descripcion || '').trim(),
      listas: []
    };
    this.proveedoresSubject.next([...actuales, proveedor]);
    this.persistirProveedores();
    this.persistirSqliteKv('proveedores', this.proveedoresSubject.value);
    return proveedor;
  }

  eliminarProveedor(id: number): boolean {
    const actuales = this.proveedoresSubject.value;
    const restantes = actuales.filter(p => p.id !== id);
    if (restantes.length === actuales.length) return false;
    this.proveedoresSubject.next(restantes);
    this.persistirProveedores();
    this.persistirSqliteKv('proveedores', this.proveedoresSubject.value);
    return true;
  }

  actualizarProveedor(data: { id: number; nombre: string; ubicacion: string; descripcion: string; }): boolean {
    const proveedores = this.proveedoresSubject.value;
    const idx = proveedores.findIndex(p => p.id === data.id);
    if (idx === -1) return false;
    const actual = proveedores[idx];
    proveedores[idx] = {
      ...actual,
      nombre: (data.nombre || '').trim(),
      ubicacion: (data.ubicacion || '').trim(),
      descripcion: (data.descripcion || '').trim(),
    };
    this.proveedoresSubject.next([...proveedores]);
    this.persistirProveedores();
    return true;
  }

  agregarListaPrecios(proveedorId: number, nombreArchivo: string, items: ItemListaProveedor[]): ListaPreciosProveedor | null {
    const proveedores = this.proveedoresSubject.value;
    const idx = proveedores.findIndex(p => p.id === proveedorId);
    if (idx === -1) return null;
    const listas = proveedores[idx].listas || [];
    const nextId = listas.length ? Math.max(...listas.map(l => l.id)) + 1 : 1;
    const lista: ListaPreciosProveedor = {
      id: nextId,
      proveedorId,
      nombreArchivo,
      fechaCarga: new Date(),
      items: items.map(it => ({
        codigo: String(it.codigo || '').trim(),
        nombre: String(it.nombre || '').trim(),
        precio: Number(it.precio || 0)
      }))
    };
    proveedores[idx] = { ...proveedores[idx], listas: [...listas, lista] };
    this.proveedoresSubject.next([...proveedores]);
    this.persistirProveedores();
    this.persistirSqliteKv('proveedores', this.proveedoresSubject.value);
    return lista;
  }

  getItemsProveedor(proveedorId: number): ItemListaProveedor[] {
    const prov = this.proveedoresSubject.value.find(p => p.id === proveedorId);
    if (!prov) return [];
    const todos = (prov.listas || []).flatMap(l => l.items || []);
    const map = new Map<string, ItemListaProveedor>();
    for (const lista of (prov.listas || []).sort((a, b) => b.fechaCarga.getTime() - a.fechaCarga.getTime())) {
      for (const it of (lista.items || [])) {
        const key = (it.codigo || '').trim();
        if (key && !map.has(key)) {
          map.set(key, it);
        }
      }
    }
    return Array.from(map.values());
  }

  vaciarListasProveedor(proveedorId: number): boolean {
    const proveedores = this.proveedoresSubject.value;
    const idx = proveedores.findIndex(p => p.id === proveedorId);
    if (idx === -1) return false;
    proveedores[idx] = { ...proveedores[idx], listas: [] };
    this.proveedoresSubject.next([...proveedores]);
    this.persistirProveedores();
    this.persistirSqliteKv('proveedores', this.proveedoresSubject.value);
    return true;
  }

  getPedidosProveedor(proveedorId: number): PedidoProveedor[] {
    return this.pedidosSubject.value
      .filter(p => p.proveedorId === proveedorId)
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  agregarPedidoProveedor(data: { proveedorId: number; items: PedidoItemProveedor[]; }): PedidoProveedor {
    const pedidos = this.pedidosSubject.value;
    const nextId = pedidos.length ? Math.max(...pedidos.map(p => p.id)) + 1 : 1;
    const total = data.items.reduce((acc, it) => acc + Number(it.subtotal || (Number(it.precio) * Number(it.cantidad))), 0);
    const pedido: PedidoProveedor = {
      id: nextId,
      proveedorId: data.proveedorId,
      fecha: new Date(),
      items: data.items.map(it => ({ ...it, subtotal: Number(it.subtotal || (Number(it.precio) * Number(it.cantidad))) })),
      total: Number(total.toFixed(2)),
      entregado: false,
      pagado: false
    };
    this.pedidosSubject.next([pedido, ...pedidos]);
    this.persistirPedidos();
    this.persistirSqliteKv('pedidos', this.pedidosSubject.value);
    return pedido;
  }

  actualizarPedidoFlags(id: number, cambios: Partial<Pick<PedidoProveedor, 'entregado' | 'pagado'>>): void {
    const pedidos = this.pedidosSubject.value;
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx === -1) return;
    pedidos[idx] = { ...pedidos[idx], ...cambios };
    this.pedidosSubject.next([...pedidos]);
    this.persistirPedidos();
    this.persistirSqliteKv('pedidos', this.pedidosSubject.value);
  }

  eliminarPedidoProveedor(id: number): boolean {
    const pedidos = this.pedidosSubject.value;
    const restantes = pedidos.filter(p => p.id !== id);
    if (restantes.length === pedidos.length) return false;
    this.pedidosSubject.next(restantes);
    this.persistirPedidos();
    this.persistirSqliteKv('pedidos', this.pedidosSubject.value);
    return true;
  }
  private async persistirSqliteKv(key: string, value: any): Promise<void> {
    try {
      const electronAPI: any = (window as any)?.electronAPI;
      if (!electronAPI?.kvSet) return;
      await electronAPI.kvSet(key, JSON.stringify(value));
    } catch {}
  }
}