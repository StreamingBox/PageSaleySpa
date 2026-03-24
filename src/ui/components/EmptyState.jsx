export default function EmptyState({ title, description, action }) {
    return (
        <div className="empty-state">
            <div className="empty-state__pulse" />
            <h3>{title}</h3>
            <p>{description}</p>
            {action ? <div className="empty-state__action">{action}</div> : null}
        </div>
    );
}
