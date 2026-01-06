const board = document.getElementById("board");
const addColumnButton = document.getElementById("add-column");
const columnTemplate = document.getElementById("column-template");
const cardTemplate = document.getElementById("card-template");

const STORAGE_KEY = "flowboard-data-v1";

const state = {
  columns: [],
};

const createId = () => crypto.randomUUID();

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const loadState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.columns = [
      {
        id: createId(),
        title: "Планы",
        cards: [
          { id: createId(), text: "Сделать адаптивную сетку" },
          { id: createId(), text: "Добавить жесты" },
        ],
      },
      {
        id: createId(),
        title: "В работе",
        cards: [{ id: createId(), text: "UX под мобильные" }],
      },
      {
        id: createId(),
        title: "Готово",
        cards: [{ id: createId(), text: "Сохранение без перезагрузки" }],
      },
    ];
    saveState();
    return;
  }

  const parsed = JSON.parse(saved);
  state.columns = parsed.columns ?? [];
};

const render = () => {
  board.innerHTML = "";
  state.columns.forEach((column) => {
    const columnEl = columnTemplate.content.firstElementChild.cloneNode(true);
    columnEl.dataset.columnId = column.id;
    const titleEl = columnEl.querySelector(".column__title");
    titleEl.textContent = column.title;

    const listEl = columnEl.querySelector("[data-cards]");

    column.cards.forEach((card) => {
      const cardEl = cardTemplate.content.firstElementChild.cloneNode(true);
      cardEl.dataset.cardId = card.id;
      cardEl.querySelector(".card__content").textContent = card.text;
      listEl.appendChild(cardEl);
    });

    board.appendChild(columnEl);
  });
};

const addColumn = () => {
  state.columns.push({
    id: createId(),
    title: "Новая колонка",
    cards: [],
  });
  saveState();
  render();
};

const addCard = (columnId) => {
  const column = state.columns.find((item) => item.id === columnId);
  if (!column) return;
  column.cards.push({ id: createId(), text: "Новая задача" });
  saveState();
  render();
};

const removeColumn = (columnId) => {
  state.columns = state.columns.filter((item) => item.id !== columnId);
  saveState();
  render();
};

const removeCard = (columnId, cardId) => {
  const column = state.columns.find((item) => item.id === columnId);
  if (!column) return;
  column.cards = column.cards.filter((card) => card.id !== cardId);
  saveState();
  render();
};

const updateColumnTitle = (columnId, title) => {
  const column = state.columns.find((item) => item.id === columnId);
  if (!column) return;
  column.title = title || "Без названия";
  saveState();
};

const updateCardText = (columnId, cardId, text) => {
  const column = state.columns.find((item) => item.id === columnId);
  if (!column) return;
  const card = column.cards.find((item) => item.id === cardId);
  if (!card) return;
  card.text = text || "Новая задача";
  saveState();
};

const moveCard = (cardId, targetColumnId, targetIndex) => {
  let movedCard = null;
  let sourceColumnId = null;

  state.columns.forEach((column) => {
    const index = column.cards.findIndex((card) => card.id === cardId);
    if (index !== -1) {
      movedCard = column.cards.splice(index, 1)[0];
      sourceColumnId = column.id;
    }
  });

  if (!movedCard) return;
  const targetColumn = state.columns.find((item) => item.id === targetColumnId);
  if (!targetColumn) return;

  const insertIndex = Number.isFinite(targetIndex)
    ? targetIndex
    : targetColumn.cards.length;
  targetColumn.cards.splice(insertIndex, 0, movedCard);
  saveState();
  render();

  if (sourceColumnId !== targetColumnId) {
    const highlight = board.querySelector(`[data-column-id="${targetColumnId}"] [data-cards]`);
    if (highlight) {
      highlight.classList.add("column__list--highlight");
      setTimeout(() => highlight.classList.remove("column__list--highlight"), 600);
    }
  }
};

let dragState = null;

const startDrag = (cardEl, pointerEvent) => {
  const columnEl = cardEl.closest("[data-column]");
  if (!columnEl) return;

  const rect = cardEl.getBoundingClientRect();
  dragState = {
    cardId: cardEl.dataset.cardId,
    offsetX: pointerEvent.clientX - rect.left,
    offsetY: pointerEvent.clientY - rect.top,
  };

  cardEl.classList.add("card--dragging");
  moveDragged(cardEl, pointerEvent.clientX, pointerEvent.clientY);
};

const moveDragged = (cardEl, clientX, clientY) => {
  cardEl.style.left = `${clientX - dragState.offsetX}px`;
  cardEl.style.top = `${clientY - dragState.offsetY}px`;
};

const finishDrag = (cardEl, clientX, clientY) => {
  cardEl.classList.remove("card--dragging");
  cardEl.style.left = "";
  cardEl.style.top = "";

  const dropTarget = document.elementFromPoint(clientX, clientY);
  const columnEl = dropTarget?.closest("[data-column]");
  if (!columnEl) return;

  const listEl = columnEl.querySelector("[data-cards]");
  const cards = Array.from(listEl.querySelectorAll("[data-card]"));
  const targetCard = dropTarget?.closest("[data-card]");
  let targetIndex = cards.length;

  if (targetCard && targetCard.dataset.cardId !== dragState.cardId) {
    targetIndex = cards.findIndex((card) => card.dataset.cardId === targetCard.dataset.cardId);
  }

  moveCard(dragState.cardId, columnEl.dataset.columnId, targetIndex);
};

const handlePointerDown = (event) => {
  const cardEl = event.target.closest("[data-card]");
  if (!cardEl || event.target.closest("[data-remove-card]")) return;

  event.preventDefault();
  cardEl.setPointerCapture(event.pointerId);
  startDrag(cardEl, event);

  const move = (moveEvent) => {
    if (!dragState) return;
    moveDragged(cardEl, moveEvent.clientX, moveEvent.clientY);
  };

  const up = (upEvent) => {
    if (!dragState) return;
    finishDrag(cardEl, upEvent.clientX, upEvent.clientY);
    dragState = null;
    cardEl.releasePointerCapture(upEvent.pointerId);
    cardEl.removeEventListener("pointermove", move);
    cardEl.removeEventListener("pointerup", up);
    cardEl.removeEventListener("pointercancel", up);
  };

  cardEl.addEventListener("pointermove", move);
  cardEl.addEventListener("pointerup", up);
  cardEl.addEventListener("pointercancel", up);
};

board.addEventListener("pointerdown", handlePointerDown);

board.addEventListener("click", (event) => {
  const addCardButton = event.target.closest("[data-add-card]");
  if (addCardButton) {
    const columnId = addCardButton.closest("[data-column]").dataset.columnId;
    addCard(columnId);
  }

  const removeColumnButton = event.target.closest("[data-remove-column]");
  if (removeColumnButton) {
    const columnId = removeColumnButton.closest("[data-column]").dataset.columnId;
    removeColumn(columnId);
  }

  const removeCardButton = event.target.closest("[data-remove-card]");
  if (removeCardButton) {
    const cardEl = removeCardButton.closest("[data-card]");
    const columnId = removeCardButton.closest("[data-column]").dataset.columnId;
    removeCard(columnId, cardEl.dataset.cardId);
  }
});

board.addEventListener("focusout", (event) => {
  const columnTitle = event.target.closest(".column__title");
  if (columnTitle) {
    updateColumnTitle(
      columnTitle.closest("[data-column]").dataset.columnId,
      columnTitle.textContent.trim()
    );
  }

  const cardContent = event.target.closest(".card__content");
  if (cardContent) {
    updateCardText(
      cardContent.closest("[data-column]").dataset.columnId,
      cardContent.closest("[data-card]").dataset.cardId,
      cardContent.textContent.trim()
    );
  }
});

addColumnButton.addEventListener("click", addColumn);

loadState();
render();
