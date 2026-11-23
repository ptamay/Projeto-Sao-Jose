export type ItemStatus = 'available' | 'in_use';

export default function ItemStatusBadge({ status, id }: { status: ItemStatus; id?: string }) {
    return (
        <span id={id} className={`status-tag ${status === 'available' ? 'status-available' : 'status-inuse'}`}>
            {status === 'available' ? 'Disponível' : 'Em uso'}
        </span>
    );
}
