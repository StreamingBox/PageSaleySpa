import { Link } from 'react-router-dom';

export default function NotFoundPage() {
    return (
        <section className="panel">
            <p className="panel__eyebrow">404</p>
            <h3>La ruta no existe dentro del panel</h3>
            <p>Vuelve al dashboard para retomar el flujo principal.</p>
            <Link className="button button--primary" to="/">
                Ir al dashboard
            </Link>
        </section>
    );
}
