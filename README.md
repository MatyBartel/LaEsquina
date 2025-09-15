# 🏪 Ferretería MC - Sistema de Control de Stock y Ventas

Aplicación de escritorio desarrollada con **Electron** y **Angular** para la gestión integral de una ferretería.

## ✨ Características

- **Dashboard Inteligente**: Vista general de productos, stock y ventas
- **Gestión de Productos**: CRUD completo con control de stock
- **Sistema de Ventas**: Registro de ventas con múltiples productos
- **Control de Stock**: Alertas automáticas de stock bajo
- **Reportes**: Análisis de ventas y rendimiento
- **Base de Datos Local**: SQLite para almacenamiento persistente
- **Interfaz Moderna**: Diseño responsive y intuitivo

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js (versión 18 o superior)
- npm o yarn
- Git

### Pasos de Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd ferreteria-app
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Instalar dependencias de Electron**
   ```bash
   npm run postinstall
   ```

## 🏃‍♂️ Ejecutar la Aplicación

### Modo Desarrollo

Para ejecutar la aplicación en modo desarrollo con recarga automática:

```bash
npm run electron:dev
```

Este comando:
- Inicia el servidor Angular en `http://localhost:4200`
- Abre la aplicación Electron
- Permite recarga automática de cambios

### Modo Producción

Para construir y ejecutar la aplicación empaquetada:

```bash
# Construir la aplicación
npm run electron:build

# Ejecutar desde la carpeta dist
npm run electron
```

## 📁 Estructura del Proyecto

```
ferreteria-app/
├── src/                    # Código fuente de Angular
│   ├── app/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── services/       # Servicios y lógica de negocio
│   │   └── features/       # Módulos de funcionalidad
├── electron/               # Código de Electron
│   ├── main.js            # Proceso principal
│   ├── preload.js         # Script de precarga
│   └── dev.js             # Configuración de desarrollo
├── public/                 # Archivos estáticos
└── dist/                   # Build de producción
```

## 🛠️ Scripts Disponibles

- `npm start` - Inicia solo Angular
- `npm run electron` - Ejecuta solo Electron
- `npm run electron:dev` - Modo desarrollo completo
- `npm run electron:build` - Construye la aplicación
- `npm run electron:pack` - Empaqueta sin instalar
- `npm test` - Ejecuta pruebas unitarias

## 🔧 Configuración de Electron

### Archivo Principal (`electron/main.js`)
- Configuración de la ventana principal
- Menú personalizado con atajos de teclado
- Manejo de eventos de la aplicación

### Preload (`electron/preload.js`)
- API segura para comunicación entre procesos
- Exposición de funcionalidades de Electron
- Manejo de notificaciones del sistema

## 📊 Base de Datos

La aplicación utiliza **SQLite** para almacenamiento local:

- **Productos**: Información completa de inventario
- **Ventas**: Registro de transacciones
- **Stock**: Control automático de inventario
- **Reportes**: Datos agregados para análisis

## 🎨 Interfaz de Usuario

### Dashboard Principal
- Estadísticas en tiempo real
- Productos con stock bajo
- Últimas ventas
- Acciones rápidas

### Navegación
- Menú superior responsive
- Rutas organizadas por funcionalidad
- Breadcrumbs para navegación

## 🚨 Alertas y Notificaciones

- **Stock Bajo**: Alertas automáticas cuando el stock está por debajo del mínimo
- **Notificaciones del Sistema**: Integración con notificaciones nativas
- **Validaciones**: Verificación de datos en formularios

## 📱 Responsive Design

La aplicación se adapta a diferentes tamaños de pantalla:
- **Desktop**: Vista completa con todas las funcionalidades
- **Tablet**: Layout adaptado para pantallas medianas
- **Mobile**: Navegación optimizada para pantallas pequeñas

## 🔒 Seguridad

- **Context Isolation**: Separación segura entre procesos
- **Node Integration**: Deshabilitada por defecto
- **Preload Scripts**: Comunicación controlada con Electron

## 🧪 Pruebas

```bash
# Ejecutar pruebas unitarias
npm test

# Ejecutar pruebas con coverage
npm run test:coverage
```

## 📦 Empaquetado

### Windows
```bash
npm run electron:build -- --win
```

### macOS
```bash
npm run electron:build -- --mac
```

### Linux
```bash
npm run electron:build -- --linux
```

## 🐛 Solución de Problemas

### Error: "Electron not found"
```bash
npm run postinstall
```

### Error: "Port 4200 already in use"
```bash
# Terminar procesos en el puerto 4200
npx kill-port 4200
```

### Error: "Module not found"
```bash
# Limpiar cache e instalar de nuevo
rm -rf node_modules package-lock.json
npm install
```

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Para soporte técnico o consultas:
- Crear un issue en el repositorio
- Contactar al equipo de desarrollo

---

**Desarrollado con ❤️ para Ferretería MC**
