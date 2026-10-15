import { FORM_STYLE, type FormLetter } from "./seasonView";

export function FormChips({ form }: { form: FormLetter[] }) {
  if (form.length === 0) return <span className="text-xs text-muted">–</span>;
  return (
    <span className="flex gap-0.5" aria-label={`Form: ${form.join(" ")}`}>
      {form.map((f, i) => (
        <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold ${FORM_STYLE[f]}`}>
          {f}
        </span>
      ))}
    </span>
  );
}
