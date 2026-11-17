import { APP_NAME } from "@askwell/shared";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <h1 className="rounded-glass border border-glass-border bg-glass px-10 py-8 text-4xl font-semibold shadow-glass backdrop-blur-(--blur-glass)">
        {APP_NAME}
      </h1>
    </main>
  );
}
