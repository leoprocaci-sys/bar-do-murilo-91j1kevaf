import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { AuthGuard } from '@/components/AuthGuard'
import { AuthProvider } from '@/hooks/use-auth'
import Index from '@/pages/Index'
import Login from '@/pages/Login'
import PrimeiroAcesso from '@/pages/PrimeiroAcesso'
import PlaceholderFinanceiro from '@/pages/PlaceholderFinanceiro'
import Usuarios from '@/pages/Usuarios'
import NovoUsuario from '@/pages/NovoUsuario'
import NotFound from '@/pages/NotFound'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
})

const Protected = ({ children }: { children: React.ReactNode }) => <AuthGuard>{children}</AuthGuard>

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/primeiro-acesso"
              element={
                <Protected>
                  <PrimeiroAcesso />
                </Protected>
              }
            />
            <Route
              path="/"
              element={
                <Protected>
                  <Index />
                </Protected>
              }
            />
            <Route
              path="/fiado"
              element={
                <Protected>
                  <PlaceholderFinanceiro modulo="FIADO" />
                </Protected>
              }
            />
            <Route
              path="/caixa"
              element={
                <Protected>
                  <PlaceholderFinanceiro modulo="CAIXA" />
                </Protected>
              }
            />
            <Route
              path="/usuarios"
              element={
                <Protected>
                  <Usuarios />
                </Protected>
              }
            />
            <Route
              path="/usuarios/novo"
              element={
                <Protected>
                  <NovoUsuario />
                </Protected>
              }
            />
            <Route path="/inicio" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
