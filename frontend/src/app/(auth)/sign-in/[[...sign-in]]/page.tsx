import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">Sage</h1>
          <p className="text-slate-300 mt-2">El asistente de conocimiento privado de tu empresa</p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
