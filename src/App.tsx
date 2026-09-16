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
import FiadoLista from '@/pages/fiado/FiadoLista'
import FiadoBloqueados from '@/pages/fiado/FiadoBloqueados'
import FiadoClienteForm from '@/pages/fiado/FiadoClienteForm'
import FiadoFichaCliente from '@/pages/fiado/FiadoFichaCliente'
import FiadoConsumoForm from '@/pages/fiado/FiadoConsumoForm'
import FiadoPagamentoForm from '@/pages/fiado/FiadoPagamentoForm'

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
                  <FiadoLista />
                </Protected>
              }
            />
            <Route
              path="/fiado/bloqueados"
              element={
                <Protected>
                  <FiadoBloqueados />
                </Protected>
              }
            />
            <Route
              path="/fiado/novo"
              element={
                <Protected>
                  <FiadoClienteForm />
                </Protected>
              }
            />
            <Route
              path="/fiado/cliente/:id"
              element={
                <Protected>
                  <FiadoFichaCliente />
                </Protected>
              }
            />
            <Route
              path="/fiado/cliente/:id/editar"
              element={
                <Protected>
                  <FiadoClienteForm />
                </Protected>
              }
            />
            <Route
              path="/fiado/cliente/:id/consumo"
              element={
                <Protected>
                  <FiadoConsumoForm />
                </Protected>
              }
            />
            <Route
              path="/fiado/pagamento"
              element={
                <Protected>
                  <FiadoPagamentoForm />
                </Protected>
              }
            />
            <Route
              path="/fiado/cliente/:id/pagamento"
              element={
                <Protected>
                  <FiadoPagamentoForm />
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
