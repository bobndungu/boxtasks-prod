import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options?: SelectOption[];
  placeholder?: string;
  error?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, error, size = 'md', children, ...props }, ref) => {
    const sizeClasses = {
      sm: 'px-2 py-1 text-sm pr-7',
      md: 'px-3 py-2 pr-9',
      lg: 'px-4 py-3 text-lg pr-10',
    };

    const iconSizes = {
      sm: 'h-3 w-3 right-2',
      md: 'h-4 w-4 right-3',
      lg: 'h-5 w-5 right-3',
    };

    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            // Base styles
            'w-full appearance-none cursor-pointer',
            'rounded-lg border bg-white text-gray-900',
            'transition-colors duration-200',
            // Focus styles
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            // Dark mode
            'dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600',
            'dark:focus:ring-blue-500 dark:focus:border-blue-500',
            // Hover
            'hover:border-gray-400 dark:hover:border-gray-500',
            // Disabled
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800',
            // Error state
            error && 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-500',
            // Normal border
            !error && 'border-gray-300',
            // Size
            sizeClasses[size],
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          className={cn(
            'absolute top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500',
            iconSizes[size]
          )}
        />
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
