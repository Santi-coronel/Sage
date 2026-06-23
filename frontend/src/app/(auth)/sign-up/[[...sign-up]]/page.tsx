import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-strong to-slate-900">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">Sage</h1>
          <p className="text-slate-300 mt-2">Creá tu cuenta para empezar</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
