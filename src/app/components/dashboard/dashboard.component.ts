import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DatabaseService, Producto, Venta } from '../../services/database.service';
import { Subscription } from 'rxjs';

interface BackupStatus {
  localOk: boolean;
  cloudOk: boolean;
  lastRun: string | null;
  lastFile: string | null;
  cloudPath: string | null;
  error: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  totalProductos = 0;
  totalVentasHoy = 0; 
  totalGastadoHoy = 0;
  productosBajoStock = 0;
  totalVentas = 0;
  productosBajoStockList: Producto[] = [];
  ultimasVentas: Venta[] = [];
  backupCloudOk: boolean | null = null;
  backupLastRun: string | null = null;
  backupEnCurso = false;
  backupDisponible = false;

  fechaSeleccionada = '';
  mostrarCalendario = false;
  private ventasSnapshot: Venta[] = [];

  private subscription = new Subscription();

  constructor(private databaseService: DatabaseService) {}

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarEstadoBackup();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    const electronAPI: any = (window as any)?.electronAPI;
    electronAPI?.removeBackupStatusListener?.();
  }

  private async cargarEstadoBackup(): Promise<void> {
    const electronAPI: any = (window as any)?.electronAPI;
    if (!electronAPI?.backupGetStatus) {
      this.backupDisponible = false;
      this.backupCloudOk = null;
      return;
    }
    this.backupDisponible = true;
    electronAPI.onBackupStatusChanged?.((status: BackupStatus) => {
      this.aplicarEstadoBackup(status);
    });
    const status = await electronAPI.backupGetStatus();
    if (status) this.aplicarEstadoBackup(status);
  }

  private aplicarEstadoBackup(status: BackupStatus): void {
    this.backupCloudOk = !!status.cloudOk;
    this.backupLastRun = status.lastRun || null;
    this.backupEnCurso = false;
  }

  get etiquetaUltimoBackup(): string {
    if (!this.backupLastRun) return 'pendiente';
    const d = new Date(this.backupLastRun);
    if (isNaN(d.getTime())) return 'pendiente';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async ejecutarBackupAhora(): Promise<void> {
    const electronAPI: any = (window as any)?.electronAPI;
    if (!electronAPI?.backupRunNow || this.backupEnCurso) return;
    this.backupEnCurso = true;
    try {
      const status = await electronAPI.backupRunNow();
      if (status) this.aplicarEstadoBackup(status);
    } finally {
      this.backupEnCurso = false;
    }
  }

  async abrirCarpetaBackup(): Promise<void> {
    const electronAPI: any = (window as any)?.electronAPI;
    if (electronAPI?.openBackupFolder) {
      await electronAPI.openBackupFolder();
    }
  }

  private cargarDatos(): void {
    this.subscription.add(
      this.databaseService.productos$.subscribe(productos => {
        this.totalProductos = productos.length;
        this.productosBajoStock = productos.filter(p => p.stockMinimo > 0 && p.stock <= p.stockMinimo).length;
        this.productosBajoStockList = productos
          .filter(p => p.stockMinimo > 0 && p.stock <= p.stockMinimo);
      })
    );

    this.subscription.add(
      this.databaseService.ventas$.subscribe(ventas => {
        this.ventasSnapshot = ventas;
        this.aplicarFiltroDia();
      })
    );

    this.subscription.add(
      this.databaseService.gastos$.subscribe(() => {
        this.aplicarFiltroDia();
      })
    );
  }

  get tituloVentasCard(): string {
    return this.fechaSeleccionada ? `Ventas del ${this.fechaSeleccionada}` : 'Ventas Hoy';
  }

  get tituloGastadoCard(): string {
    return this.fechaSeleccionada ? `Total Gastado del ${this.fechaSeleccionada}` : 'Total Gastado Hoy';
  }

  get tituloUltimas(): string {
    return this.fechaSeleccionada ? 'Últimas Ventas del día' : 'Últimas Ventas';
  }

  onFechaChangeDesdeDate(value: string): void {
    if (!value) {
      this.fechaSeleccionada = '';
    } else {
      const [y, m, d] = value.split('-');
      this.fechaSeleccionada = `${d}/${m}/${y}`;
    }
    this.mostrarCalendario = false;
    this.aplicarFiltroDia();
  }

  limpiarFecha(): void {
    this.fechaSeleccionada = '';
    this.aplicarFiltroDia();
  }

  private aplicarFiltroDia(): void {
    const ventas = this.ventasSnapshot || [];
    let inicio: Date;
    let fin: Date;
    if (this.fechaSeleccionada) {
      const [d, m, y] = this.fechaSeleccionada.split('/').map(n => Number(n));
      inicio = new Date(y, m - 1, d, 0, 0, 0, 0);
      fin = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      const hoy = new Date();
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);
    }

    const delDia = ventas.filter(v => v.fecha >= inicio && v.fecha <= fin);
    this.totalVentas = delDia.length;
    this.totalVentasHoy = delDia.reduce((acc, v) => acc + v.total, 0);
    this.totalGastadoHoy = this.databaseService.getTotalGastosEnRango(inicio, fin);
    this.ultimasVentas = delDia
      .slice()
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 5);
  }

  nuevoProducto(): void {
    alert('Función de Nuevo Producto - En desarrollo');
  }

  nuevaVenta(): void {
    alert('Función de Nueva Venta - En desarrollo');
  }

  gestionarProductos(): void {
    alert('Función de Gestionar Productos - En desarrollo');
  }

  verVentas(): void {
    alert('Función de Ver Ventas - En desarrollo');
  }

  async abrirCarpetaDatos(): Promise<void> {
    const electronAPI: any = (window as any)?.electronAPI;
    if (electronAPI?.openDataFolder) {
      await electronAPI.openDataFolder();
    }
  }
} 