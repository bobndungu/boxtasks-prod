import { useState } from 'react';
import {
  Clock,
  Target,
  Gauge,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  Loader2,
} from 'lucide-react';
import { type Card } from '../lib/api/cards';
import { toast } from '../lib/stores/toast';

type EstimateType = 'hours' | 'points' | 'tshirt';
type Complexity = 'trivial' | 'low' | 'medium' | 'high' | 'very_high';

const ESTIMATE_TYPES: { value: EstimateType; label: string }[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'points', label: 'Story Points' },
  { value: 'tshirt', label: 'T-Shirt Size' },
];

const TSHIRT_SIZES: { value: number; label: string }[] = [
  { value: 1, label: 'XS' },
  { value: 2, label: 'S' },
  { value: 3, label: 'M' },
  { value: 5, label: 'L' },
  { value: 8, label: 'XL' },
  { value: 13, label: 'XXL' },
];

const COMPLEXITY_OPTIONS: { value: Complexity; label: string; color: string }[] = [
  { value: 'trivial', label: 'Trivial', color: 'bg-gray-200 text-gray-700' },
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'very_high', label: 'Very High', color: 'bg-red-100 text-red-700' },
];

interface EstimateEditorProps {
  card: Card;
  onUpdate: (cardId: string, updates: Partial<Card>) => Promise<void> | void;
  canEdit: boolean;
}

export function EstimateEditor({ card, onUpdate, canEdit }: EstimateEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<'estimate' | 'complexity' | null>(null);
  const [saving, setSaving] = useState(false);

  // Local state ONLY for edit mode - initialized when entering edit mode
  const [editEstimateType, setEditEstimateType] = useState<EstimateType>('hours');
  const [editEstimateValue, setEditEstimateValue] = useState<number | ''>('');
  const [editComplexity, setEditComplexity] = useState<Complexity | ''>('');

  // Enter edit mode for estimate - copy current values to local state
  const startEditingEstimate = () => {
    setEditEstimateType(card.estimateType || 'hours');
    setEditEstimateValue(card.estimate ?? '');
    setEditing('estimate');
  };

  // Enter edit mode for complexity - copy current value to local state
  const startEditingComplexity = () => {
    setEditComplexity(card.complexity || '');
    setEditing('complexity');
  };

  const handleSaveEstimate = async () => {
    const valueToSave = editEstimateValue;
    const typeToSave = editEstimateType;
    try {
      setSaving(true);
      await onUpdate(card.id, {
        estimate: valueToSave === '' ? undefined : (valueToSave as number),
        estimateType: valueToSave === '' ? undefined : typeToSave,
      });
      setEditing(null);
      toast.success('Estimate updated');
    } catch (error) {
      console.error('Error saving estimate:', error);
      toast.error('Failed to save estimate');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveComplexity = async () => {
    const valueToSave = editComplexity;
    try {
      setSaving(true);
      await onUpdate(card.id, {
        complexity: valueToSave === '' ? undefined : (valueToSave as Complexity),
      });
      setEditing(null);
      toast.success('Complexity updated');
    } catch (error) {
      console.error('Error saving complexity:', error);
      toast.error('Failed to save complexity');
    } finally {
      setSaving(false);
    }
  };

  const formatEstimate = (value?: number, type?: EstimateType): string => {
    if (value === undefined || value === null) return 'Not set';

    if (type === 'tshirt') {
      const size = TSHIRT_SIZES.find((s) => s.value === value);
      return size ? size.label : `${value}`;
    }

    if (type === 'points') {
      return `${value} ${value === 1 ? 'point' : 'points'}`;
    }

    return `${value} ${value === 1 ? 'hour' : 'hours'}`;
  };

  const getComplexityColor = (value?: Complexity): string => {
    const option = COMPLEXITY_OPTIONS.find((o) => o.value === value);
    return option ? option.color : 'bg-gray-100 text-gray-500';
  };

  const getComplexityLabel = (value?: Complexity): string => {
    const option = COMPLEXITY_OPTIONS.find((o) => o.value === value);
    return option ? option.label : 'Not set';
  };

  // Check if there's any estimate data to show (from card props)
  const hasEstimateData = card.estimate !== undefined || card.complexity !== undefined;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Target className="w-4 h-4" />
          Estimates
        </span>
        <div className="flex items-center gap-2">
          {!expanded && hasEstimateData && (
            <div className="flex items-center gap-2 text-xs">
              {card.estimate !== undefined && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  {formatEstimate(card.estimate, card.estimateType)}
                </span>
              )}
              {card.complexity && (
                <span className={`px-2 py-0.5 rounded ${getComplexityColor(card.complexity)}`}>
                  {getComplexityLabel(card.complexity)}
                </span>
              )}
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Estimate Section */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                Time Estimate
              </span>
              {canEdit && editing !== 'estimate' && (
                <button
                  onClick={startEditingEstimate}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {editing === 'estimate' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Estimate Type
                  </label>
                  <div className="flex gap-2">
                    {ESTIMATE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setEditEstimateType(type.value)}
                        className={`px-3 py-1.5 text-sm rounded-md border ${
                          editEstimateType === type.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-500'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {editEstimateType === 'tshirt' ? 'Size' : 'Value'}
                  </label>
                  {editEstimateType === 'tshirt' ? (
                    <div className="flex flex-wrap gap-2">
                      {TSHIRT_SIZES.map((size) => (
                        <button
                          key={size.value}
                          onClick={() => setEditEstimateValue(size.value)}
                          className={`px-3 py-1.5 text-sm rounded-md border ${
                            editEstimateValue === size.value
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-500'
                          }`}
                        >
                          {size.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={editEstimateValue}
                      onChange={(e) => setEditEstimateValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      min={0}
                      step={editEstimateType === 'hours' ? 0.5 : 1}
                      placeholder={editEstimateType === 'hours' ? 'e.g., 2.5' : 'e.g., 5'}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEstimate}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatEstimate(card.estimate, card.estimateType)}
              </div>
            )}
          </div>

          {/* Complexity Section */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Gauge className="w-4 h-4" />
                Complexity
              </span>
              {canEdit && editing !== 'complexity' && (
                <button
                  onClick={startEditingComplexity}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {editing === 'complexity' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {COMPLEXITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setEditComplexity(option.value)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
                        editComplexity === option.value
                          ? `${option.color} border-current ring-2 ring-offset-1`
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveComplexity}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <span className={`inline-block px-2 py-1 text-sm rounded ${getComplexityColor(card.complexity)}`}>
                {getComplexityLabel(card.complexity)}
              </span>
            )}
          </div>

          {/* Clear Estimates Button */}
          {canEdit && hasEstimateData && (
            <button
              onClick={async () => {
                try {
                  setSaving(true);
                  await onUpdate(card.id, {
                    estimate: undefined,
                    estimateType: undefined,
                    complexity: undefined,
                  });
                  toast.success('Estimates cleared');
                } catch (error) {
                  console.error('Error clearing estimates:', error);
                  toast.error('Failed to clear estimates');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 py-2"
            >
              Clear all estimates
            </button>
          )}
        </div>
      )}
    </div>
  );
}
