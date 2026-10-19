import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
      <h1 className="text-3xl font-bold">Choose a new password</h1>
      <div className="rounded-xl border border-border bg-surface p-6">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
