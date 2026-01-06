# FaceBlur Studio 🎭

**Herramienta profesional de pixelación de rostros para protección de privacidad en videos**

FaceBlur Studio es una aplicación web de alto rendimiento que utiliza inteligencia artificial para detectar y pixelar rostros en videos en tiempo real, garantizando la privacidad y el anonimato.

## ✨ Características

- 🎯 **Detección de rostros en tiempo real** usando face-api.js
- 🔒 **Procesamiento 100% local** - sin envío de datos a servidores externos
- 📹 **Soporte para múltiples fuentes**: cámara web o archivos de video
- 🎨 **Pixelación ajustable** para diferentes niveles de anonimización
- 💾 **Exportación de video procesado** en formato WebM
- 📱 **PWA (Progressive Web App)** - instalable y funciona offline
- ⚡ **Service Worker** para carga rápida y funcionamiento sin conexión

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js (para el servidor de desarrollo)
- Navegador moderno con soporte para WebRTC y Canvas API

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/faceblur.git
cd faceblur

# Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 📖 Uso

1. **Seleccionar fuente de video**: Elige entre usar tu cámara web o cargar un archivo de video
2. **Ajustar configuración**: Configura el nivel de pixelación y otras opciones
3. **Iniciar procesamiento**: La aplicación detectará y pixelará rostros automáticamente
4. **Exportar resultado**: Descarga el video procesado cuando termines

## 🛠️ Tecnologías

- **face-api.js**: Detección de rostros basada en TensorFlow.js
- **Canvas API**: Renderizado y procesamiento de video
- **Service Worker**: Caché y funcionamiento offline
- **PWA**: Instalación y experiencia nativa

## 📁 Estructura del Proyecto

```
faceblur/
├── index.html          # Aplicación principal
├── sw.js              # Service Worker
├── manifest.json      # PWA manifest
├── models/            # Modelos de IA para detección facial
├── css/               # Estilos
├── js/                # Scripts JavaScript
└── assets/            # Recursos estáticos
```

## 🔒 Privacidad

**Todo el procesamiento se realiza localmente en tu navegador**. Ningún video o imagen se envía a servidores externos. Los modelos de IA se descargan una vez y se almacenan en caché para uso offline.

## 📝 Licencia

MIT License - Ver archivo LICENSE para más detalles

## 👨‍💻 Autor

Desarrollado con ❤️ para proteger la privacidad

---

**Nota**: Esta aplicación requiere permisos de cámara si deseas procesar video en tiempo real desde tu webcam.
