const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');

// Configuración del entorno de desarrollo
process.env.NODE_ENV = 'development';

// Función para ejecutar comandos
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Función principal
async function main() {
  try {
    console.log('🚀 Iniciando entorno de desarrollo...');
    
    // Verificar si Angular está ejecutándose
    const isAngularRunning = await checkIfPortInUse(4200);
    
    if (!isAngularRunning) {
      console.log('📱 Iniciando servidor Angular...');
      // Iniciar Angular en segundo plano
      runCommand('npm', ['run', 'start'], { detached: true });
      
      // Esperar a que Angular esté listo
      console.log('⏳ Esperando a que Angular esté listo...');
      await waitForPort(4200, 30000); // Esperar máximo 30 segundos
    }
    
    console.log('✅ Angular está ejecutándose en http://localhost:4200');
    console.log('🖥️  Iniciando aplicación Electron...');
    
  } catch (error) {
    console.error('❌ Error al iniciar el entorno de desarrollo:', error);
    process.exit(1);
  }
}

// Función para verificar si un puerto está en uso
function checkIfPortInUse(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(false);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(true);
    });
  });
}

// Función para esperar a que un puerto esté disponible
function waitForPort(port, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkPort = () => {
      checkIfPortInUse(port).then((isInUse) => {
        if (isInUse) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for port ${port}`));
        } else {
          setTimeout(checkPort, 500);
        }
      });
    };
    
    checkPort();
  });
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = { main, checkIfPortInUse, waitForPort }; 