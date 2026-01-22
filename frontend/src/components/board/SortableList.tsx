import { useState, useRef } from 'react';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  MoreHorizontal,
  X,
  Trash2,
  GripVertical,
  Archive,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Palette,
  LayoutTemplate,
} from 'lucide-react';
import { LIST_COLORS, VIRTUAL_THRESHOLD } from './constants';
import { SortableCard } from './SortableCard';
import type { SortableListProps } from './types';

export function SortableList({
  list,
  cards,
  onDeleteList,
  onArchiveList,
  onUpdateList,
  onCardClick,
  onQuickComplete,
  onQuickArchive,
  addingCardToList,
  setAddingCardToList,
  newCardTitle,
  setNewCardTitle,
  onAddCard,
  onOpenTemplatePicker,
  collapsedLists,
  toggleCollapse,
  customFieldDefs,
  customFieldValues,
  searchQuery = '',
  fieldVisibility,
  canCreateCard,
  canEditList,
  canDeleteList,
  canArchiveCard,
}: SortableListProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWipSettings, setShowWipSettings] = useState(false);
  const [wipLimitValue, setWipLimitValue] = useState(list.wipLimit?.toString() || '0');

  const virtualContainerRef = useRef<HTMLDivElement>(null);
  const useVirtual = cards.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => virtualContainerRef.current,
    estimateSize: () => 80,
    overscan: 5,
    enabled: useVirtual,
  });

  const isCollapsed = collapsedLists.has(list.id);
  const isOverWipLimit = list.wipLimit > 0 && cards.length > list.wipLimit;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id });

  // Make the card area a droppable target for cards from other lists
  const { setNodeRef: setCardAreaDroppableRef } = useDroppable({
    id: `list-droppable-${list.id}`,
    data: {
      type: 'list',
      listId: list.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== list.title) {
      onUpdateList(list.id, { title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleColorSelect = (color: string | null) => {
    onUpdateList(list.id, { color });
    setShowColorPicker(false);
    setShowMenu(false);
  };

  const handleWipLimitSave = () => {
    const limit = parseInt(wipLimitValue) || 0;
    onUpdateList(list.id, { wipLimit: limit });
    setShowWipSettings(false);
    setShowMenu(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-100 dark:bg-gray-800 rounded-xl w-72 flex-shrink-0 flex flex-col ${isCollapsed ? '' : 'max-h-full'}`}
    >
      {/* Color Bar */}
      {list.color && (
        <div
          className="h-2 rounded-t-xl"
          style={{ backgroundColor: list.color }}
        />
      )}

      {/* List Header */}
      <div
        className={`p-3 flex items-center justify-between ${list.color ? '' : 'rounded-t-xl'}`}
      >
        <div
          {...attributes}
          {...listeners}
          className="flex items-center flex-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-1 flex-shrink-0" />
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') {
                  setEditedTitle(list.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 px-2 py-1 rounded border border-blue-500 outline-none flex-1"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3
              className="font-semibold text-gray-800 dark:text-white cursor-text flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            >
              {list.title}
            </h3>
          )}
          {/* WIP Limit Badge */}
          {list.wipLimit > 0 && (
            <span
              className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                isOverWipLimit
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {cards.length}/{list.wipLimit}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {/* Collapse Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(list.id);
            }}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>

          {/* Menu Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                <div className="py-1">
                  {canCreateCard && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setAddingCardToList(list.id);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add card
                    </button>
                  )}
                  {canEditList && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(!showColorPicker);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Set color
                    </button>
                  )}
                  {showColorPicker && (
                    <div className="px-4 py-2 flex flex-wrap gap-2">
                      {LIST_COLORS.map((color) => (
                        <button
                          key={color.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleColorSelect(color.value);
                          }}
                          className={`w-6 h-6 rounded-full border-2 ${
                            list.color === color.value ? 'border-blue-500' : 'border-gray-200 dark:border-gray-600'
                          }`}
                          style={{ backgroundColor: color.value || '#e5e7eb' }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  )}
                  {canEditList && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowWipSettings(!showWipSettings);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Set WIP limit
                      </button>
                      {showWipSettings && (
                        <div className="px-4 py-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="0"
                              value={wipLimitValue}
                              onChange={(e) => setWipLimitValue(e.target.value)}
                              className="w-16 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWipLimitSave();
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                            >
                              Set
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">0 = no limit</p>
                        </div>
                      )}
                    </>
                  )}
                  {canDeleteList && (
                    <>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onArchiveList(list.id);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive list
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          const confirmed = await confirm({
                            title: 'Delete List',
                            message: 'Are you sure you want to delete this list and all its cards? This action cannot be undone.',
                            confirmLabel: 'Delete',
                            variant: 'danger',
                          });
                          if (confirmed) {
                            onDeleteList(list.id);
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete list
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WIP Limit Warning */}
      {isOverWipLimit && !isCollapsed && (
        <div className="mx-2 mb-2 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>Over WIP limit ({cards.length}/{list.wipLimit})</span>
        </div>
      )}

      {/* Cards (collapsible) - with optional virtual scrolling for large lists */}
      {!isCollapsed && (
        <div
          ref={virtualContainerRef}
          className="flex-1 overflow-y-auto px-2 pb-2"
          style={useVirtual ? { contain: 'content' } : undefined}
        >
          {/* Add Card Form - at the top of the list */}
          {addingCardToList === list.id ? (
            <div className="bg-white dark:bg-gray-700 rounded-lg p-2 shadow-sm mb-2">
              <textarea
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onAddCard(list.id);
                  }
                }}
                placeholder="Enter a title for this card..."
                autoFocus
                className="w-full p-2 text-sm border-none outline-none resize-none bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                rows={3}
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onAddCard(list.id)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                >
                  Add card
                </button>
                <button
                  onClick={() => {
                    setAddingCardToList(null);
                    setNewCardTitle('');
                  }}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : canCreateCard ? (
            <div className="flex items-center gap-1 mb-2">
              <button
                onClick={() => setAddingCardToList(list.id)}
                className="flex-1 text-left px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg flex items-center text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add a card
              </button>
              <button
                onClick={() => onOpenTemplatePicker(list.id)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                title="Create from template"
              >
                <LayoutTemplate className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {useVirtual ? (
              <div
                ref={setCardAreaDroppableRef}
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                  minHeight: '50px',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const card = cards[virtualItem.index];
                  if (!card) return null;
                  return (
                    <div
                      key={card.id}
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                        paddingBottom: '8px',
                      }}
                    >
                      <SortableCard
                        card={card}
                        onClick={() => onCardClick(card)}
                        onQuickComplete={(e) => {
                          e.stopPropagation();
                          onQuickComplete(card);
                        }}
                        onQuickArchive={(e) => {
                          e.stopPropagation();
                          onQuickArchive(card);
                        }}
                        onQuickEdit={(e) => {
                          e.stopPropagation();
                          onCardClick(card);
                        }}
                        customFieldDefs={customFieldDefs}
                        cardCustomFieldValues={customFieldValues.get(card.id) || []}
                        searchQuery={searchQuery}
                        fieldVisibility={fieldVisibility}
                        canArchiveCard={canArchiveCard(card.authorId || '')}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div ref={setCardAreaDroppableRef} className="space-y-2 min-h-[50px]">
                {cards.map((card) => (
                  <SortableCard
                    key={card.id}
                    card={card}
                    onClick={() => onCardClick(card)}
                    onQuickComplete={(e) => {
                      e.stopPropagation();
                      onQuickComplete(card);
                    }}
                    onQuickArchive={(e) => {
                      e.stopPropagation();
                      onQuickArchive(card);
                    }}
                    onQuickEdit={(e) => {
                      e.stopPropagation();
                      onCardClick(card);
                    }}
                    customFieldDefs={customFieldDefs}
                    cardCustomFieldValues={customFieldValues.get(card.id) || []}
                    searchQuery={searchQuery}
                    fieldVisibility={fieldVisibility}
                    canArchiveCard={canArchiveCard(card.authorId || '')}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </div>
      )}

      {/* Collapsed Summary */}
      {isCollapsed && (
        <div className="px-3 pb-3 text-sm text-gray-500 dark:text-gray-400">
          {cards.length} card{cards.length !== 1 ? 's' : ''}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
