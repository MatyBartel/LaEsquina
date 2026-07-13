import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { VentasComponent } from './components/ventas/ventas.component';
import { StockComponent } from './components/stock/stock.component';
import { EstadisticasComponent } from './components/estadisticas/estadisticas.component';
import { GastosComponent } from './components/gastos/gastos.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'ventas', component: VentasComponent },
  { path: 'stock', component: StockComponent },
  { path: 'stock/agregar', redirectTo: 'stock' },
  { path: 'stock/editar/:id', redirectTo: 'stock' },
  { path: 'estadisticas', component: EstadisticasComponent },
  { path: 'gastos', component: GastosComponent },
  { path: 'proveedores', redirectTo: 'gastos' },
  { path: '**', redirectTo: '' }
];
