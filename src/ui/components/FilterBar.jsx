export default function FilterBar({ children, actions }) {
    return (
        <section className="filter-bar">
            <div className="filter-bar__fields">{children}</div>
            {actions ? <div className="filter-bar__actions">{actions}</div> : null}
        </section>
    );
}
