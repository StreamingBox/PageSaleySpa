# Android App

Configuración base creada para empaquetar SaleySpa como app Android con Capacitor.

## Estado actual

- `appId`: `com.saleyspa.app`
- `appName`: `SaleySpa`
- URL remota cargada por la app: `https://saleyspa.shop/`
- Proyecto Android nativo: [`android/`](../android)
- Logo maestro para assets: [`public/brand/logo-1024.png`](../public/brand/logo-1024.png)

La app Android actual carga el sitio productivo dentro de un WebView nativo. Esto se eligió porque la autenticación y el `initialState` del panel siguen dependiendo del backend Express renderizado en servidor.

## Comandos

```bash
npm run android:add
npm run android:assets
npm run android:sync
npm run android:open
```

## Requisitos locales para compilar APK o AAB

1. Instalar Android Studio.
2. Instalar Android SDK y al menos una plataforma moderna desde el SDK Manager.
3. Definir una de estas opciones:

```text
ANDROID_HOME
ANDROID_SDK_ROOT
```

o crear `android/local.properties` con:

```properties
sdk.dir=C:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk
```

## Compilar

Debug APK:

```bash
cd android
gradlew assembleDebug
```

Release AAB/APK:

```bash
cd android
gradlew bundleRelease
```

## Publicar la APK desde la web

Cuando ya tengas una APK compilada, súbela a una ruta pública del proyecto, por ejemplo:

```text
public/downloads/SaleySpa.apk
```

Quedará disponible en:

```text
https://saleyspa.shop/downloads/SaleySpa.apk
```

Y en la página puedes usar un botón simple como este:

```html
<a class="download-apk-button" href="/downloads/SaleySpa.apk" download>
    <span>📱</span>
    <span>Descargar app (APK)</span>
</a>
```

Ejemplo de estilo:

```css
.download-apk-button {
    display: inline-flex;
    gap: 10px;
    align-items: center;
    padding: 14px 18px;
    border-radius: 14px;
    background: #1f2749;
    color: #ffffff;
    font-weight: 700;
    text-decoration: none;
}
```

## Nota importante

Si más adelante quieres una app más nativa y menos dependiente del WebView remoto, habrá que desacoplar el frontend del render server-side actual para que pueda correr localmente dentro de Capacitor y consumir la API por URL base configurable.
