import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { AuthGuard } from '@/components/AuthGuard'
import { AuthProvider } from '@/hooks/use-auth'
import Index from '@/pages/Index'
import Login from '@/pages/Login'
import EsqueciSenha from '@/pages/EsqueciSenha'
import RedefinirSenha from '@/pages/RedefinirSenha'
import PrimeiroAcesso from '@/pages/PrimeiroAcesso'
import CaixaHome from '@/pages/caixa/CaixaHome'
import CaixaVendaForm from '@/pages/caixa/CaixaVendaForm'
import CaixaSaidaForm from '@/pages/caixa/CaixaSaidaForm'
import CaixaRetiradaForm from '@/pages/caixa/CaixaRetiradaForm'
import CaixaDevolucaoCreditoForm from '@/pages/caixa/CaixaDevolucaoCreditoForm'
import CaixaMovimentacaoDia from '@/pages/caixa/CaixaMovimentacaoDia'
import CaixaRelatorios from '@/pages/caixa/CaixaRelatorios'
import CaixaConsumoPessoa from '@/pages/caixa/CaixaConsumoPessoa'
import Usuarios from '@/pages/Usuarios'
import NovoUsuario from '@/pages/NovoUsuario'
import MeuEmail from '@/pages/MeuEmail'
import NotFound from '@/pages/NotFound'
import FiadoLista from '@/pages/fiado/FiadoLista'
import FiadoBloqueados from '@/pages/fiado/FiadoBloqueados'
import FiadoClienteForm from '@/pages/fiado/FiadoClienteForm'
import FiadoFichaCliente from '@/pages/fiado/FiadoFichaCliente'
import FiadoConsumoForm from '@/pages/fiado/FiadoConsumoForm'
import FiadoPagamentoForm from '@/pages/fiado/FiadoPagamentoForm'
import FiadoRelatorios from '@/pages/fiado/FiadoRelatorios'

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
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
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
              path="/fiado/relatorios"
              element={
                <Protected>
                  <FiadoRelatorios />
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
                  <CaixaHome />
                </Protected>
              }
            />
            <Route
              path="/caixa/venda"
              element={
                <Protected>
                  <CaixaVendaForm />
                </Protected>
              }
            />
            <Route
              path="/caixa/saida"
              element={
                <Protected>
                  <CaixaSaidaForm />
                </Protected>
              }
            />
            <Route
              path="/caixa/retirada"
              element={
                <Protected>
                  <CaixaRetiradaForm />
                </Protected>
              }
            />
            <Route
              path="/caixa/devolucao-credito"
              element={
                <Protected>
                  <CaixaDevolucaoCreditoForm />
                </Protected>
              }
            />
            <Route
              path="/caixa/movimentacao"
              element={
                <Protected>
                  <CaixaMovimentacaoDia />
                </Protected>
              }
            />
            <Route
              path="/caixa/relatorios"
              element={
                <Protected>
                  <CaixaRelatorios />
                </Protected>
              }
            />
            <Route
              path="/caixa/consumo-pessoa"
              element={
                <Protected>
                  <CaixaConsumoPessoa />
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
            <Route
              path="/usuarios/meu-email"
              element={
                <Protected>
                  <MeuEmail />
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
