import { X, Keyboard } from 'lucide-react';
import { NAVIGATION_SHORTCUTS } from '../lib/hooks/useKeyboardNavigation';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const BOARD_SHORTCUTS = [
  { keys: ['⌘/Ctrl', 'K'], description: 'Open search' },
  { keys: ['N'], description: 'New card in focused list' },
  { keys: ['L'], description: 'New list' },
  { keys: ['A'], description: 'Toggle activity sidebar' },
  { keys: ['F'], description: 'Open filters' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
];

const CARD_MODAL_SHORTCUTS = [
  { keys: ['Escape'], description: 'Close modal' },
  { keys: ['E'], description: 'Edit description' },
  { keys: ['C'], description: 'Add comment' },
  { keys: ['D'], description: 'Set due date' },
  { keys: ['M'], description: 'Assign members' },
  { keys: ['T'], description: 'Toggle completed' },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Keyboard className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Navigation */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                Board Navigation
              </h3>
              <div className="space-y-3">
                {NAVIGATION_SHORTCUTS.map((shortcut, index) => (
                  <ShortcutRow
                    key={index}
                    keys={shortcut.keys}
                    description={shortcut.description}
                  />
                ))}
              </div>
            </div>

            {/* Board Actions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                Board Actions
              </h3>
              <div className="space-y-3">
                {BOARD_SHORTCUTS.map((shortcut, index) => (
                  <ShortcutRow
                    key={index}
                    keys={shortcut.keys}
                    description={shortcut.description}
                  />
                ))}
              </div>
            </div>

            {/* Card Modal */}
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                Card Modal
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {CARD_MODAL_SHORTCUTS.map((shortcut, index) => (
                  <ShortcutRow
                    key={index}
                    keys={shortcut.keys}
                    description={shortcut.description}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Press any arrow key or h/j/k/l to start navigation mode</li>
              <li>• Vim-style navigation: h (left), j (down), k (up), l (right)</li>
              <li>• Shortcuts are disabled when typing in input fields</li>
              <li>• Press Escape to exit navigation mode or close modals</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index} className="flex items-center">
            <kbd className="px-2 py-1 text-xs font-medium bg-gray-100 border border-gray-300 rounded-md shadow-sm min-w-[28px] text-center">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="mx-1 text-gray-400 text-xs">/</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// Small floating indicator showing current navigation mode
export function NavigationModeIndicator({
  isActive,
  listTitle,
  cardIndex,
  totalCards,
}: {
  isActive: boolean;
  listTitle?: string;
  cardIndex: number;
  totalCards: number;
}) {
  if (!isActive) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
      <Keyboard className="h-4 w-4 text-blue-400" />
      <span className="text-sm">
        {listTitle && (
          <>
            <span className="font-medium">{listTitle}</span>
            <span className="mx-2 text-gray-400">•</span>
          </>
        )}
        Card {cardIndex + 1} of {totalCards}
      </span>
      <span className="text-xs text-gray-400 border-l border-gray-700 pl-3">
        Press ? for help
      </span>
    </div>
  );
}
