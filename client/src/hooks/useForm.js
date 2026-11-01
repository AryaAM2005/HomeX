import { useState } from 'react';
import { getErrorMessage, getFieldErrors } from '../api/client';

// Runs client checks, submits, and maps server errors back onto the fields.
export function useForm({ initial, validate, onSubmit }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showErrors = (form, nextErrors) => {
    setErrors(nextErrors);
    const firstField = Object.keys(nextErrors)[0];
    if (firstField) form.elements[firstField]?.focus?.();
  };

  const setValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError('');

    const clientErrors = validate(values);
    if (Object.keys(clientErrors).length > 0) {
      showErrors(form, clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) showErrors(form, fieldErrors);
      else setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event) => setValue(name, event.target.value),
  });

  return { values, errors, formError, submitting, field, setValue, handleSubmit };
}
