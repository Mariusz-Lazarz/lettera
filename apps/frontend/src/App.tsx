function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Welcome to Lettera
          </h1>
          <p className="text-xl text-muted-foreground">
            AI-powered cover letter generator built with React 19, NestJS, and Prisma
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
            <div className="rounded-lg border bg-card p-6 w-full sm:w-64">
              <h3 className="font-semibold mb-2">Frontend</h3>
              <p className="text-sm text-muted-foreground">
                React 19 + Vite + TypeScript + Tailwind CSS 4 + shadcn/ui
              </p>
            </div>
            
            <div className="rounded-lg border bg-card p-6 w-full sm:w-64">
              <h3 className="font-semibold mb-2">Backend</h3>
              <p className="text-sm text-muted-foreground">
                NestJS + Prisma + PostgreSQL
              </p>
            </div>
          </div>

          <div className="pt-8 border-t">
            <p className="text-sm text-muted-foreground">
              ✨ Monorepo configured and ready to develop
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Start by editing <code className="text-primary">apps/frontend/src/App.tsx</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
