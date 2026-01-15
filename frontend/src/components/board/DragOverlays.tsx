import { GripVertical } from 'lucide-react';
import { LABEL_COLORS } from './constants';
import type { CardDragOverlayProps, ListDragOverlayProps } from './types';

export function CardDragOverlay({ card }: CardDragOverlayProps) {
  if (!card) return null;

  return (
    <div className="bg-white rounded-lg p-3 shadow-lg rotate-3 cursor-grabbing w-64">
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((label) => (
            <div
              key={label}
              className="w-10 h-2 rounded"
              style={{ backgroundColor: LABEL_COLORS[label] }}
            />
          ))}
        </div>
      )}
      <p className="text-sm text-gray-800">{card.title}</p>
    </div>
  );
}

export function ListDragOverlay({ list, cards }: ListDragOverlayProps) {
  if (!list) return null;

  return (
    <div className="bg-gray-100 rounded-xl w-72 p-3 shadow-lg rotate-2 cursor-grabbing max-h-96 overflow-hidden">
      <div className="flex items-center mb-3">
        <GripVertical className="h-4 w-4 text-gray-400 mr-1" />
        <h3 className="font-semibold text-gray-800">{list.title}</h3>
      </div>
      <div className="space-y-2">
        {cards.slice(0, 3).map((card) => (
          <div key={card.id} className="bg-white rounded-lg p-2 shadow-sm">
            <p className="text-sm text-gray-800 truncate">{card.title}</p>
          </div>
        ))}
        {cards.length > 3 && (
          <div className="text-sm text-gray-500 text-center">
            +{cards.length - 3} more cards
          </div>
        )}
      </div>
    </div>
  );
}
