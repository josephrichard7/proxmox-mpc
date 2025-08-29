/**
 * Accessible Form Components
 * 
 * WCAG 2.1 AA compliant form components with validation and screen reader support.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Checkbox,
  Radio,
  Switch,
  Button,
  Group,
  Stack,
  Text,
  Alert,
  Box,
  Fieldset,
  Progress
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useFormAnnouncements } from '../../hooks/useAccessibility';

// Form field validation interface
interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | undefined;
}

interface BaseFieldProps {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  validation?: ValidationRule;
  disabled?: boolean;
  'aria-describedby'?: string;
}

interface FormContextType {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  setFieldValue: (name: string, value: any) => void;
  setFieldError: (name: string, error: string) => void;
  setFieldTouched: (name: string, touched: boolean) => void;
  validateField: (name: string) => void;
}

// Form Context
const FormContext = React.createContext<FormContextType | null>(null);

// Form Provider Component
interface AccessibleFormProps {
  children: React.ReactNode;
  initialValues: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  validation?: Record<string, ValidationRule>;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const AccessibleForm: React.FC<AccessibleFormProps> = ({
  children,
  initialValues,
  onSubmit,
  validation = {},
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { announceError, announceSuccess, announceFieldChange } = useFormAnnouncements();
  const formRef = useRef<HTMLFormElement>(null);

  // Validate individual field
  const validateField = (name: string) => {
    const value = values[name];
    const rules = validation[name];
    
    if (!rules) return;

    let error: string | undefined;

    // Required validation
    if (rules.required && (!value || value.toString().trim() === '')) {
      error = `${name} is required`;
    }
    // String length validation
    else if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        error = `${name} must be at least ${rules.minLength} characters`;
      } else if (rules.maxLength && value.length > rules.maxLength) {
        error = `${name} must be no more than ${rules.maxLength} characters`;
      }
    }
    // Number validation
    else if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        error = `${name} must be at least ${rules.min}`;
      } else if (rules.max !== undefined && value > rules.max) {
        error = `${name} must be no more than ${rules.max}`;
      }
    }
    
    // Pattern validation
    if (!error && rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      error = `${name} format is invalid`;
    }
    
    // Custom validation
    if (!error && rules.custom) {
      error = rules.custom(value);
    }

    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
      if (touched[name]) {
        announceError(name, error);
      }
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Set field value
  const setFieldValue = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    announceFieldChange(name, value?.toString() || 'empty');
  };

  // Set field error
  const setFieldError = (name: string, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
    announceError(name, error);
  };

  // Set field touched
  const setFieldTouched = (name: string, touchedValue: boolean) => {
    setTouched(prev => ({ ...prev, [name]: touchedValue }));
  };

  // Validate form on field changes
  useEffect(() => {
    Object.keys(touched).forEach(name => {
      if (touched[name]) {
        validateField(name);
      }
    });
  }, [values, touched, validation]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const allErrors: Record<string, string> = {};
    Object.keys(validation).forEach(name => {
      const value = values[name];
      const rules = validation[name];
      
      if (rules?.required && (!value || value.toString().trim() === '')) {
        allErrors[name] = `${name} is required`;
      }
    });

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const firstErrorField = Object.keys(allErrors)[0];
      announceError('Form', `Please fix errors in ${Object.keys(allErrors).length} field(s), starting with ${firstErrorField}`);
      
      // Focus first field with error
      const firstErrorElement = formRef.current?.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
      firstErrorElement?.focus();
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit(values);
      announceSuccess('Form submitted successfully');
    } catch (error) {
      announceError('Form', 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contextValue: FormContextType = {
    values,
    errors,
    touched,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    validateField,
  };

  const errorCount = Object.keys(errors).length;
  const completionPercentage = Math.round(
    (Object.keys(touched).filter(key => !errors[key]).length / Object.keys(validation).length) * 100
  );

  return (
    <FormContext.Provider value={contextValue}>
      <Box>
        {/* Form progress indicator */}
        {Object.keys(validation).length > 0 && (
          <Box mb="md">
            <Text size="sm" color="dimmed" mb="xs">
              Form completion: {completionPercentage}%
            </Text>
            <Progress 
              value={completionPercentage} 
              size="sm" 
              aria-label={`Form ${completionPercentage}% complete`}
            />
          </Box>
        )}

        {/* Error summary */}
        {errorCount > 0 && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            color="red"
            mb="md"
            role="alert"
            aria-live="assertive"
          >
            <Text fw={500} size="sm" mb="xs">
              Please fix {errorCount} error{errorCount !== 1 ? 's' : ''}:
            </Text>
            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>
                  <Text size="sm">{error}</Text>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className={className}
          role="form"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          noValidate
        >
          {children}
        </form>
      </Box>
    </FormContext.Provider>
  );
};

// Field wrapper component
interface FormFieldProps extends BaseFieldProps {
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  description,
  required = false,
  children,
  'aria-describedby': ariaDescribedBy,
}) => {
  const context = React.useContext(FormContext);
  if (!context) throw new Error('FormField must be used within AccessibleForm');

  const { errors, touched } = context;
  const error = errors[name];
  const hasError = error && touched[name];
  
  const errorId = `${name}-error`;
  const descriptionId = `${name}-description`;
  const combinedDescribedBy = [
    ariaDescribedBy,
    description ? descriptionId : undefined,
    hasError ? errorId : undefined,
  ].filter(Boolean).join(' ');

  return (
    <Box mb="md">
      <Text 
        component="label" 
        fw={500} 
        size="sm" 
        mb="xs"
        htmlFor={name}
      >
        {label}
        {required && (
          <Text component="span" color="red" ml="xs" aria-label="required">
            *
          </Text>
        )}
      </Text>
      
      {description && (
        <Text id={descriptionId} size="xs" color="dimmed" mb="xs">
          {description}
        </Text>
      )}

      {React.cloneElement(children as React.ReactElement, {
        name,
        id: name,
        required,
        error: hasError ? error : undefined,
        'aria-describedby': combinedDescribedBy || undefined,
        'aria-invalid': hasError || undefined,
      })}

      {hasError && (
        <Text id={errorId} size="xs" color="red" mt="xs" role="alert">
          {error}
        </Text>
      )}
    </Box>
  );
};

// Accessible Text Input
interface AccessibleTextInputProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'url' | 'tel';
  placeholder?: string;
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
}

export const AccessibleTextInput: React.FC<AccessibleTextInputProps> = (props) => {
  const context = React.useContext(FormContext);
  if (!context) throw new Error('AccessibleTextInput must be used within AccessibleForm');

  const { values, setFieldValue, setFieldTouched } = context;
  const value = values[props.name] || '';

  return (
    <FormField {...props}>
      <TextInput
        type={props.type || 'text'}
        placeholder={props.placeholder}
        leftSection={props.leftSection}
        rightSection={props.rightSection}
        value={value}
        onChange={(e) => setFieldValue(props.name, e.currentTarget.value)}
        onBlur={() => setFieldTouched(props.name, true)}
        disabled={props.disabled}
        autoComplete={props.type === 'email' ? 'email' : props.type === 'password' ? 'current-password' : undefined}
      />
    </FormField>
  );
};

// Accessible Select
interface AccessibleSelectProps extends BaseFieldProps {
  data: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
}

export const AccessibleSelect: React.FC<AccessibleSelectProps> = (props) => {
  const context = React.useContext(FormContext);
  if (!context) throw new Error('AccessibleSelect must be used within AccessibleForm');

  const { values, setFieldValue, setFieldTouched } = context;
  const value = values[props.name] || '';

  return (
    <FormField {...props}>
      <Select
        data={props.data}
        placeholder={props.placeholder}
        searchable={props.searchable}
        clearable={props.clearable}
        value={value}
        onChange={(val) => setFieldValue(props.name, val)}
        onBlur={() => setFieldTouched(props.name, true)}
        disabled={props.disabled}
      />
    </FormField>
  );
};

// Form submit button with accessibility features
interface AccessibleSubmitButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'filled' | 'light' | 'outline' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const AccessibleSubmitButton: React.FC<AccessibleSubmitButtonProps> = ({
  children,
  loading = false,
  disabled = false,
  ...buttonProps
}) => {
  const context = React.useContext(FormContext);
  if (!context) throw new Error('AccessibleSubmitButton must be used within AccessibleForm');

  const { errors } = context;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Button
      type="submit"
      loading={loading}
      disabled={disabled || hasErrors}
      aria-describedby={hasErrors ? 'form-errors' : undefined}
      {...buttonProps}
    >
      {children}
    </Button>
  );
};