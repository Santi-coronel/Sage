import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">Sage</h1>
          <p className="text-slate-400 mt-2">Create your account to get started</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
