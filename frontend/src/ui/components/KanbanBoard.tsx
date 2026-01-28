import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from './Card';
import { Badge } from './Badge';
import { User, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

type Ticket = {
  id: string;
  key: number;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; email: string; name: string | null };
  assignedTo: { id: string; email: string; name: string | null } | null;
};

type Column = {
  id: string;
  title: string;
  status: Ticket['status'];
  color: string;
};

const columns: Column[] = [
  { id: 'open', title: 'Yeni', status: 'OPEN', color: 'bg-blue-50 border-blue-200' },
  { id: 'in_progress', title: 'İşlemde', status: 'IN_PROGRESS', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'resolved', title: 'Çözüldü', status: 'RESOLVED', color: 'bg-green-50 border-green-200' },
  { id: 'closed', title: 'Kapalı', status: 'CLOSED', color: 'bg-slate-50 border-slate-200' }
];

const priorityVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger'
};

const priorityLabels: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
};

function KanbanCard({ ticket }: { ticket: Ticket }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="p-3 mb-2 cursor-move hover:shadow-md transition-shadow">
        <Link to={`/tickets/${ticket.id}`} className="block">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-900 truncate">#{ticket.key}</div>
              <div className="text-sm text-slate-700 line-clamp-2">{ticket.title}</div>
            </div>
            <Badge variant={priorityVariants[ticket.priority]} className="shrink-0">
              {priorityLabels[ticket.priority]}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            {ticket.assignedTo ? (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate">{ticket.assignedTo.name || ticket.assignedTo.email}</span>
              </div>
            ) : (
              <span>Atanmamış</span>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{new Date(ticket.updatedAt).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </Link>
      </Card>
    </div>
  );
}

function KanbanColumn({ column, tickets }: { column: Column; tickets: Ticket[] }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={clsx('rounded-lg border-2 p-3 mb-3', column.color)}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">{column.title}</h3>
          <span className="text-xs text-slate-600 bg-white px-2 py-1 rounded-full">{tickets.length}</span>
        </div>
      </div>
      <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[200px]">
          {tickets.map((ticket) => (
            <KanbanCard key={ticket.id} ticket={ticket} />
          ))}
          {tickets.length === 0 && (
            <div className="text-center text-sm text-slate-400 py-8">Boş</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  tickets,
  onStatusChange
}: {
  tickets: Ticket[];
  onStatusChange: (ticketId: string, newStatus: Ticket['status']) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) : null;

  const ticketsByStatus = {
    OPEN: tickets.filter((t) => t.status === 'OPEN'),
    IN_PROGRESS: tickets.filter((t) => t.status === 'IN_PROGRESS'),
    RESOLVED: tickets.filter((t) => t.status === 'RESOLVED'),
    CLOSED: tickets.filter((t) => t.status === 'CLOSED')
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const ticketId = active.id as string;
    const overId = over.id as string;

    // Eğer sütun üzerine bırakıldıysa
    const column = columns.find((c) => c.id === overId);
    if (column) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket && ticket.status !== column.status) {
        onStatusChange(ticketId, column.status);
      }
      return;
    }

    // Eğer başka bir ticket üzerine bırakıldıysa, o ticket'ın sütununu bul
    const overTicket = tickets.find((t) => t.id === overId);
    if (overTicket) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket && ticket.status !== overTicket.status) {
        onStatusChange(ticketId, overTicket.status);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tickets={ticketsByStatus[column.status]}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTicket && (
          <Card className="p-3 w-64">
            <div className="font-semibold text-sm text-slate-900">#{activeTicket.key}</div>
            <div className="text-sm text-slate-700">{activeTicket.title}</div>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}

