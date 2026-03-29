import { Download, Smartphone } from 'lucide-react';

export default function AppInstallBanner() {
    return (
        <section className="app-install-banner" aria-label="Instalar aplicacion">
            <div className="app-install-banner__icon" aria-hidden="true">
                <Smartphone size={18} />
            </div>

            <div className="app-install-banner__copy">
                <p className="app-install-banner__eyebrow">App Android</p>
                <strong>Instala SaleySpa en tu celular</strong>
                <span>Descarga la APK firmada para abrir el sistema mas rapido desde tu inicio.</span>
            </div>

            <a
                className="button button--primary app-install-banner__action"
                href="/downloads/SaleySpa.apk"
                download
            >
                <Download size={16} />
                Descargar APK
            </a>
        </section>
    );
}
