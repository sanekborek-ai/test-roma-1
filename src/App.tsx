import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  DragEndEvent,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";

const STORAGE_KEY = "flowboard-data-v2";

type Label = {
  id: string;
  name: string;
  color: string;
};

type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

type Card = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  labels: string[];
  checklist: ChecklistItem[];
};

type Column = {
  id: string;
  title: string;
  cards: Card[];
};

type Board = {
  columns: Column[];
};

type ActiveCardState = {
  columnId: string;
  cardId: string;
};

type DragData = {
  type: "column" | "card";
  columnId?: string;
};

const LABELS: Label[] = [
  { id: "important", name: "Важно", color: "#ff6b6b" },
  { id: "feature", name: "Фича", color: "#6b9bff" },
  { id: "mobile", name: "Mobile", color: "#6bffb3" },
  { id: "research", name: "R&D", color: "#ffd56b" },
];

const defaultBoard = (): Board => ({
  columns: [
    {
      id: crypto.randomUUID(),
      title: "Бэклог",
      cards: [
        {
          id: crypto.randomUUID(),
          title: "Подготовить бриф для клиента",
          description: "Собрать ожидания, цели и ограничения перед запуском спринта.",
          dueDate: "",
          labels: ["important"],
          checklist: [
            { id: crypto.randomUUID(), text: "Согласовать цели", done: true },
            { id: crypto.randomUUID(), text: "Собрать материалы", done: false },
          ],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: "В работе",
      cards: [
        {
          id: crypto.randomUUID(),
          title: "Проработать UX сценарии",
          description: "Определить ключевые пользовательские сценарии и pain-points.",
          dueDate: "",
          labels: ["mobile"],
          checklist: [],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: "Готово",
      cards: [
        {
          id: crypto.randomUUID(),
          title: "Запустить тестирование",
          description: "Передать команде QA и собрать обратную связь.",
          dueDate: "",
          labels: ["feature"],
          checklist: [],
        },
      ],
    },
  ],
});

const loadBoard = (): Board => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultBoard();
  try {
    return JSON.parse(raw) as Board;
  } catch (error) {
    console.error("Не удалось загрузить данные", error);
    return defaultBoard();
  }
};

const saveBoard = (board: Board) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
};

const createCard = (): Card => ({
  id: crypto.randomUUID(),
  title: "Новая карточка",
  description: "",
  dueDate: "",
  labels: [],
  checklist: [],
});

const createColumn = (): Column => ({
  id: crypto.randomUUID(),
  title: "Новая колонка",
  cards: [],
});

const findColumnByCardId = (columns: Column[], cardId: string) =>
  columns.find((column) => column.cards.some((card) => card.id === cardId));

const getCardById = (columns: Column[], cardId: string) =>
  columns.flatMap((column) => column.cards).find((card) => card.id === cardId);

export default function App() {
  const [board, setBoard] = useState<Board>(() => loadBoard());
  const [activeDrag, setActiveDrag] = useState<DragStartEvent["active"] | null>(
    null
  );
  const [activeCard, setActiveCard] = useState<ActiveCardState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const columns = board.columns;
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);

  const updateBoard = (updater: Board | ((prev: Board) => Board)) => {
    setBoard((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveBoard(next);
      return next;
    });
  };

  const handleAddColumn = () => {
    updateBoard((prev) => ({
      ...prev,
      columns: [...prev.columns, createColumn()],
    }));
  };

  const handleReset = () => {
    if (confirm("Сбросить доску до исходного состояния?")) {
      const next = defaultBoard();
      saveBoard(next);
      setBoard(next);
    }
  };

  const handleColumnTitleChange = (columnId: string, value: string) => {
    updateBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title: value } : column
      ),
    }));
  };

  const handleRemoveColumn = (columnId: string) => {
    if (!confirm("Удалить колонку и все карточки?")) return;
    updateBoard((prev) => ({
      ...prev,
      columns: prev.columns.filter((column) => column.id !== columnId),
    }));
  };

  const handleAddCard = (columnId: string) => {
    updateBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cards: [...column.cards, createCard()] }
          : column
      ),
    }));
  };

  const handleRemoveCard = (columnId: string, cardId: string) => {
    if (!confirm("Удалить карточку?")) return;
    updateBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cards: column.cards.filter((card) => card.id !== cardId),
            }
          : column
      ),
    }));
  };

  const handleCardUpdate = (
    columnId: string,
    cardId: string,
    updater: (prev: Card) => Card
  ) => {
    updateBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) => {
        if (column.id !== columnId) return column;
        return {
          ...column,
          cards: column.cards.map((card) =>
            card.id === cardId ? updater(card) : card
          ),
        };
      }),
    }));
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveDrag(active);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDrag(null);
    if (!over) return;

    const activeType = active.data.current?.type as DragData["type"] | undefined;
    const overType = over.data.current?.type as DragData["type"] | undefined;

    if (activeType === "column" && overType === "column") {
      const activeIndex = columns.findIndex((column) => column.id === active.id);
      const overIndex = columns.findIndex((column) => column.id === over.id);
      if (activeIndex !== overIndex) {
        updateBoard((prev) => ({
          ...prev,
          columns: arrayMove(prev.columns, activeIndex, overIndex),
        }));
      }
      return;
    }

    if (activeType === "card") {
      const activeColumn = findColumnByCardId(columns, String(active.id));
      const overColumn =
        overType === "column"
          ? columns.find((column) => column.id === over.id)
          : findColumnByCardId(columns, String(over.id));

      if (!activeColumn || !overColumn) return;

      const activeIndex = activeColumn.cards.findIndex(
        (card) => card.id === active.id
      );
      const overIndex =
        overType === "card"
          ? overColumn.cards.findIndex((card) => card.id === over.id)
          : overColumn.cards.length;

      const isSameColumn = activeColumn.id === overColumn.id;
      const adjustedIndex =
        isSameColumn && overIndex > activeIndex ? overIndex - 1 : overIndex;

      updateBoard((prev) => {
        const nextColumns = prev.columns.map((column) => {
          if (column.id === activeColumn.id) {
            return {
              ...column,
              cards: column.cards.filter((card) => card.id !== active.id),
            };
          }
          if (column.id === overColumn.id) {
            const cardToMove = activeColumn.cards[activeIndex];
            if (!cardToMove) return column;
            const updatedCards = [...column.cards];
            updatedCards.splice(adjustedIndex, 0, cardToMove);
            return { ...column, cards: updatedCards };
          }
          return column;
        });
        return { ...prev, columns: nextColumns };
      });
    }
  };

  const activeCardData =
    activeDrag?.data.current?.type === "card"
      ? getCardById(columns, String(activeDrag.id))
      : null;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Командная доска</p>
          <h1>FlowBoard</h1>
          <p className="subtitle">
            Полноценная Kanban-доска в стиле Trello — быстро, адаптивно и без
            перезагрузок.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary" onClick={handleAddColumn}>
            + Колонка
          </button>
          <button className="ghost" onClick={handleReset}>
            Сброс
          </button>
        </div>
      </header>

      <main>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            <section className="board">
              {columns.map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  onTitleChange={handleColumnTitleChange}
                  onAddCard={handleAddCard}
                  onRemoveColumn={handleRemoveColumn}
                  onRemoveCard={handleRemoveCard}
                  onEditCard={(cardId) =>
                    setActiveCard({ columnId: column.id, cardId })
                  }
                />
              ))}
            </section>
          </SortableContext>

          <DragOverlay>
            {activeDrag?.data.current?.type === "column" ? (
              <ColumnPreview
                title={
                  columns.find((column) => column.id === activeDrag.id)?.title
                }
              />
            ) : null}
            {activeCardData ? <CardPreview card={activeCardData} /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      {activeCard ? (
        <CardModal
          card={getCardById(columns, activeCard.cardId)}
          onClose={() => setActiveCard(null)}
          onUpdate={(updater) =>
            handleCardUpdate(activeCard.columnId, activeCard.cardId, updater)
          }
        />
      ) : null}
    </div>
  );
}

type ColumnProps = {
  column: Column;
  onTitleChange: (columnId: string, value: string) => void;
  onAddCard: (columnId: string) => void;
  onRemoveColumn: (columnId: string) => void;
  onRemoveCard: (columnId: string, cardId: string) => void;
  onEditCard: (cardId: string) => void;
};

function Column({
  column,
  onTitleChange,
  onAddCard,
  onRemoveColumn,
  onRemoveCard,
  onEditCard,
}: ColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: "column" satisfies DragData["type"] },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx("column", isDragging && "is-dragging")}
    >
      <div className="column-header">
        <div className="column-title-row">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="drag-handle column-handle"
            aria-label="Перетащить колонку"
          >
            ⋮⋮
          </button>
          <input
            className="column-title"
            value={column.title}
            onChange={(event) => onTitleChange(column.id, event.target.value)}
          />
          <button
            className="ghost small danger"
            onClick={() => onRemoveColumn(column.id)}
          >
            Удалить
          </button>
        </div>
        <button className="ghost small" onClick={() => onAddCard(column.id)}>
          + Карточка
        </button>
      </div>
      <SortableContext
        items={column.cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="card-list" data-column={column.id}>
          {column.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              columnId={column.id}
              onRemove={() => onRemoveCard(column.id, card.id)}
              onEdit={() => onEditCard(card.id)}
            />
          ))}
        </div>
      </SortableContext>
    </article>
  );
}

type CardItemProps = {
  card: Card;
  columnId: string;
  onRemove: () => void;
  onEdit: () => void;
};

function CardItem({ card, columnId, onRemove, onEdit }: CardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card" satisfies DragData["type"], columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completedChecklist = card.checklist?.filter((item) => item.done).length;
  const totalChecklist = card.checklist?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx("card", isDragging && "is-dragging")}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && onEdit()}
    >
      <div className="card-labels">
        {card.labels.map((labelId) => {
          const label = LABELS.find((item) => item.id === labelId);
          if (!label) return null;
          return (
            <span
              key={label.id}
              className="card-label"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          );
        })}
      </div>
      <h3 className="card-title">{card.title}</h3>
      {card.description ? (
        <p className="card-description">{card.description}</p>
      ) : null}
      <div className="card-meta">
        {card.dueDate ? (
          <span className="card-pill">Срок: {card.dueDate}</span>
        ) : null}
        {totalChecklist ? (
          <span className="card-pill">
            Чеклист: {completedChecklist}/{totalChecklist}
          </span>
        ) : null}
      </div>
      <div className="card-actions">
        <button
          className="ghost small danger"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          Удалить
        </button>
        <button
          ref={setActivatorNodeRef}
          className="drag-handle"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
        >
          ⋮⋮
        </button>
      </div>
    </div>
  );
}

type CardModalProps = {
  card?: Card;
  onClose: () => void;
  onUpdate: (updater: (prev: Card) => Card) => void;
};

function CardModal({ card, onClose, onUpdate }: CardModalProps) {
  if (!card) return null;

  const toggleLabel = (labelId: string) => {
    onUpdate((prev) => {
      const nextLabels = prev.labels.includes(labelId)
        ? prev.labels.filter((id) => id !== labelId)
        : [...prev.labels, labelId];
      return { ...prev, labels: nextLabels };
    });
  };

  const updateChecklistItem = (
    itemId: string,
    updater: (prev: ChecklistItem) => ChecklistItem
  ) => {
    onUpdate((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) =>
        item.id === itemId ? updater(item) : item
      ),
    }));
  };

  const addChecklistItem = () => {
    onUpdate((prev) => ({
      ...prev,
      checklist: [
        ...prev.checklist,
        { id: crypto.randomUUID(), text: "", done: false },
      ],
    }));
  };

  const removeChecklistItem = (itemId: string) => {
    onUpdate((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((item) => item.id !== itemId),
    }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Карточка</p>
            <input
              className="modal-title"
              value={card.title}
              onChange={(event) =>
                onUpdate((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </div>
          <button className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <section className="modal-section">
          <h4>Описание</h4>
          <textarea
            rows={4}
            value={card.description}
            onChange={(event) =>
              onUpdate((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Добавьте описание задачи"
          />
        </section>

        <section className="modal-section grid">
          <div>
            <h4>Срок</h4>
            <input
              type="date"
              value={card.dueDate}
              onChange={(event) =>
                onUpdate((prev) => ({ ...prev, dueDate: event.target.value }))
              }
            />
          </div>
          <div>
            <h4>Метки</h4>
            <div className="label-grid">
              {LABELS.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  className={clsx(
                    "label-pill",
                    card.labels.includes(label.id) && "active"
                  )}
                  style={{ "--label-color": label.color } as React.CSSProperties }
                  onClick={() => toggleLabel(label.id)}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="modal-section">
          <div className="section-row">
            <h4>Чеклист</h4>
            <button className="ghost small" onClick={addChecklistItem}>
              + Пункт
            </button>
          </div>
          <div className="checklist">
            {card.checklist.length === 0 ? (
              <p className="muted">Добавьте пункты для контроля прогресса.</p>
            ) : null}
            {card.checklist.map((item) => (
              <div key={item.id} className="checklist-item">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) =>
                    updateChecklistItem(item.id, (prev) => ({
                      ...prev,
                      done: event.target.checked,
                    }))
                  }
                />
                <input
                  className="checklist-input"
                  value={item.text}
                  onChange={(event) =>
                    updateChecklistItem(item.id, (prev) => ({
                      ...prev,
                      text: event.target.value,
                    }))
                  }
                  placeholder="Название пункта"
                />
                <button
                  className="ghost small danger"
                  onClick={() => removeChecklistItem(item.id)}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

type ColumnPreviewProps = {
  title?: string;
};

function ColumnPreview({ title }: ColumnPreviewProps) {
  return (
    <div className="column preview">
      <h3 className="preview-title">{title}</h3>
      <p className="muted">Перетащите колонку</p>
    </div>
  );
}

type CardPreviewProps = {
  card: Card;
};

function CardPreview({ card }: CardPreviewProps) {
  return (
    <div className="card preview">
      <div className="card-labels">
        {card.labels.map((labelId) => {
          const label = LABELS.find((item) => item.id === labelId);
          if (!label) return null;
          return (
            <span
              key={label.id}
              className="card-label"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          );
        })}
      </div>
      <h3 className="card-title">{card.title}</h3>
    </div>
  );
}
