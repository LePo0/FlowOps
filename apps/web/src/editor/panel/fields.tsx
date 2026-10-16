import { useId, useState, type ChangeEvent, type ReactNode } from "react";

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {error !== undefined ? (
        <p className="field__error">{error}</p>
      ) : (
        hint !== undefined && <p className="field__hint">{hint}</p>
      )}
    </div>
  );
}

// Garde la saisie telle quelle (ex. "Accept:" en cours de frappe) et transmet le texte
// à chaque frappe pour qu'il soit interprété. Remis à zéro par une `key` côté parent.
export function DraftInput({
  id,
  initialText,
  onTextChange,
  multiline = false,
  invalid = false,
  placeholder,
}: {
  id: string;
  initialText: string;
  onTextChange: (text: string) => void;
  multiline?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(initialText);
  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setText(event.target.value);
    onTextChange(event.target.value);
  };
  const props = {
    id,
    value: text,
    onChange,
    placeholder,
    className: "field__input",
    "aria-invalid": invalid,
  };
  return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
}
