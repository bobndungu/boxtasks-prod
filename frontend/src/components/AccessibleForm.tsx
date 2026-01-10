import { forwardRef } from 'react';
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { useId } from '../lib/hooks/useAccessibility';
import { cn } from '../lib/utils/cn';

// Accessible form field wrapper
interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  description,
  required,
  children,
}: FormFieldProps) {
  const descriptionId = description ? `${htmlFor}-description` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </label>

      {description && (
        <p id={descriptionId} className="text-sm text-gray-500">
          {description}
        </p>
      )}

      {children}

      {error && (
        <p
          id={errorId}
          className="text-sm text-red-600 flex items-center gap-1"
          role="alert"
        >
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

// Accessible text input
interface AccessibleInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  description?: string;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, error, description, id, required, className, ...props }, ref) => {
    const generatedId = useId('input');
    const inputId = id || generatedId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <FormField
        label={label}
        htmlFor={inputId}
        error={error}
        description={description}
        required={required}
      >
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'block w-full px-3 py-2 border rounded-lg shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            error
              ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 text-gray-900 placeholder-gray-400',
            className
          )}
          {...props}
        />
      </FormField>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';

// Accessible textarea
interface AccessibleTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  description?: string;
}

export const AccessibleTextarea = forwardRef<HTMLTextAreaElement, AccessibleTextareaProps>(
  ({ label, error, description, id, required, className, ...props }, ref) => {
    const generatedId = useId('textarea');
    const textareaId = id || generatedId;
    const descriptionId = description ? `${textareaId}-description` : undefined;
    const errorId = error ? `${textareaId}-error` : undefined;

    const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <FormField
        label={label}
        htmlFor={textareaId}
        error={error}
        description={description}
        required={required}
      >
        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'block w-full px-3 py-2 border rounded-lg shadow-sm transition-colors resize-none',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            error
              ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 text-gray-900 placeholder-gray-400',
            className
          )}
          {...props}
        />
      </FormField>
    );
  }
);

AccessibleTextarea.displayName = 'AccessibleTextarea';

// Accessible select
interface AccessibleSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  description?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(
  ({ label, error, description, id, required, options, placeholder, className, ...props }, ref) => {
    const generatedId = useId('select');
    const selectId = id || generatedId;
    const descriptionId = description ? `${selectId}-description` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;

    const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <FormField
        label={label}
        htmlFor={selectId}
        error={error}
        description={description}
        required={required}
      >
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'block w-full px-3 py-2 border rounded-lg shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            error
              ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 text-gray-900',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
);

AccessibleSelect.displayName = 'AccessibleSelect';

// Accessible checkbox
interface AccessibleCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const AccessibleCheckbox = forwardRef<HTMLInputElement, AccessibleCheckboxProps>(
  ({ label, description, id, className, ...props }, ref) => {
    const generatedId = useId('checkbox');
    const checkboxId = id || generatedId;
    const descriptionId = description ? `${checkboxId}-description` : undefined;

    return (
      <div className="flex items-start gap-2">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          aria-describedby={descriptionId}
          className={cn(
            'h-4 w-4 mt-0.5 text-blue-600 border-gray-300 rounded',
            'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            className
          )}
          {...props}
        />
        <div>
          <label htmlFor={checkboxId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>
      </div>
    );
  }
);

AccessibleCheckbox.displayName = 'AccessibleCheckbox';

// Accessible radio group
interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface AccessibleRadioGroupProps {
  name: string;
  legend: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  required?: boolean;
}

export function AccessibleRadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  required,
}: AccessibleRadioGroupProps) {
  const errorId = error ? `${name}-error` : undefined;

  return (
    <fieldset
      className="space-y-2"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={errorId}
    >
      <legend className="text-sm font-medium text-gray-700">
        {legend}
        {required && (
          <>
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </legend>

      <div className="space-y-2">
        {options.map((option) => {
          const optionId = `${name}-${option.value}`;
          const optionDescId = option.description ? `${optionId}-description` : undefined;

          return (
            <div key={option.value} className="flex items-start gap-2">
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange?.(option.value)}
                disabled={option.disabled}
                aria-describedby={optionDescId}
                className="h-4 w-4 mt-0.5 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              />
              <div>
                <label htmlFor={optionId} className="text-sm font-medium text-gray-700">
                  {option.label}
                </label>
                {option.description && (
                  <p id={optionDescId} className="text-sm text-gray-500">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
